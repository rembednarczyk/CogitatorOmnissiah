export const PREDEFINED_AWARDS = [
  { name: "Nagroda Hugo", title: "Hugo nagroda powieść" },
  { name: "Nagroda Nebula", title: "Nebula nagroda najlepsza powieść" },
  { name: "Nagroda Locus", title: "Locus nagroda powieść" },
  { name: "Wszystkie Nagrody", title: "Wszystkie" },
];

// sourceTag = znacznik „Źródło" dopisywany po kliknięciu na znalezionej pozycji.
// Jest to zarazem tag wykluczający pozycję z kolejnych skanów (zob.
// services/libraryCheckService.ts — lista `excluded`), więc oznaczenie książki
// jednocześnie usuwa ją z puli kandydatów danej filii.
export const LIBRARY_BRANCHES = [
  { id: "felin", name: "Biblioteka Felin", code: "48", sourceTag: "Biblioteka" },
  { id: "bronowice", name: "Biblioteka Bronowice", code: "7", sourceTag: "Biblioteka 9" }
];
