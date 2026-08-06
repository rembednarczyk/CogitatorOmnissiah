const allBooksToSync = [
  { polishTitle: "Diuna", originalTitle: "Dune", award: "Nagroda Hugo", awards: [] as string[] },
  { polishTitle: "Diuna", originalTitle: "Dune", award: "Nagroda Nebula", awards: [] as string[] }
];

const mergedBooksMap = new Map();
for (const book of allBooksToSync) {
  const key = (book.polishTitle || book.originalTitle || "").trim().toLowerCase();
  if (!key) continue;
  if (mergedBooksMap.has(key)) {
    const existing = mergedBooksMap.get(key);
    if (!existing.awards?.includes(book.award)) existing.awards?.push(book.award);
  } else {
    book.awards = [book.award];
    mergedBooksMap.set(key, book);
  }
}

const booksToSync = Array.from(mergedBooksMap.values());
console.log(JSON.stringify(booksToSync, null, 2));
