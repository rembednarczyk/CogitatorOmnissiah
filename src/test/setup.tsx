import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mocking global objects if needed
global.fetch = vi.fn();

// Mocking ParticleBackground
vi.mock('../components/ParticleBackground', () => ({
  ParticleBackground: () => <div data-testid="particle-background" />
}));

// Mocking Framer Motion to avoid animation issues in tests
vi.mock('motion/react', async (importOriginal) => {
  const React = await import('react');
  const motionProps = ['whileHover', 'whileTap', 'initial', 'animate', 'exit', 'transition', 'layout', 'variants'];
  
  const createMotionComponent = (tag: string) => {
    return React.forwardRef(({ children, ...props }: any, ref) => {
      const cleanProps = { ...props };
      motionProps.forEach(p => delete cleanProps[p]);
      return React.createElement(tag, { ...cleanProps, ref }, children);
    });
  };

  return {
    motion: {
      div: createMotionComponent('div'),
      span: createMotionComponent('span'),
      button: createMotionComponent('button'),
      h1: createMotionComponent('h1'),
      h2: createMotionComponent('h2'),
      h3: createMotionComponent('h3'),
      p: createMotionComponent('p'),
      section: createMotionComponent('section'),
      header: createMotionComponent('header'),
      a: createMotionComponent('a'),
    },
    AnimatePresence: ({ children }: any) => children,
  };
});

// Mocking window.matchMedia
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// Mocking fetch and streaming response
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mocking ReadableStream if not available or for better control
class MockReadableStream {
  onData: any;
  constructor(options: any) {
    if (options && options.start) {
      options.start({
        enqueue: (chunk: any) => {
          if (this.onData) this.onData(chunk);
        },
        close: () => {},
        error: (err: any) => {}
      });
    }
  }
  getReader() {
    const chunks: any[] = [];
    let resolveRead: any;
    
    this.onData = (chunk: any) => {
      if (resolveRead) {
        resolveRead({ value: chunk, done: false });
        resolveRead = null;
      } else {
        chunks.push(chunk);
      }
    };

    return {
      read: () => {
        if (chunks.length > 0) {
          return Promise.resolve({ value: chunks.shift(), done: false });
        }
        return new Promise(resolve => {
          resolveRead = resolve;
        });
      },
      releaseLock: () => {}
    };
  }
}

(global as any).ReadableStream = MockReadableStream;
vi.stubGlobal('ReadableStream', MockReadableStream);

let lastStreamController: any = null;
(global as any).getLastStreamController = () => lastStreamController;
(global as any).setLastStreamController = (controller: any) => { 
  lastStreamController = controller; 
};
(global as any).resetLastStreamController = () => { 
  lastStreamController = null; 
};

// Helper to push events to the stream
(global as any).pushStreamEvent = (type: string, data: any) => {
  if (lastStreamController) {
    const eventString = `data: ${JSON.stringify({ type, ...data })}\n\n`;
    lastStreamController.enqueue(new TextEncoder().encode(eventString));
  }
};

// Mocking Firebase
vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(() => Promise.resolve({ exists: () => false, data: () => ({}) })),
  deleteDoc: vi.fn(),
  onSnapshot: vi.fn(() => vi.fn()), // Returns unsubscribe function
  getDocFromServer: vi.fn(() => Promise.resolve({ exists: () => false })),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({
    currentUser: { uid: 'test-user' },
    onAuthStateChanged: vi.fn((cb) => {
      cb({ uid: 'test-user' });
      return vi.fn();
    }),
  })),
  signInWithPopup: vi.fn(),
  GoogleAuthProvider: vi.fn(),
}));

vi.mock('../firebase', () => ({
  db: {},
  auth: {
    currentUser: { uid: 'test-user' },
    onAuthStateChanged: vi.fn((cb) => {
      cb({ uid: 'test-user' });
      return vi.fn();
    }),
  },
}));

// Mocking Google GenAI
vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: class {
      models = {
        generateContent: vi.fn().mockResolvedValue({
          text: JSON.stringify([{ title: "Solaris - Stanislaw Lem", price: "45 PLN", link: "https://vinted.pl/123" }])
        })
      };
    }
  };
});

// Mocking Lucide icons
vi.mock('lucide-react', async () => {
  const actual = await vi.importActual('lucide-react');
  return {
    ...actual as any,
    // Add specific mocks if needed
  };
});
