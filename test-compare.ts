const existingBook = {
  id: "1",
  plTitle: "Diuna",
  origTitle: "Dune",
  awards: ["Nagroda Hugo", "Nagroda Nebula"]
};

const book = {
  polishTitle: "Diuna",
  originalTitle: "Dune",
  awards: ["Nagroda Hugo", "Nagroda Nebula"]
};

const newAwards = book.awards || [];
const existingAwards = existingBook.awards || [];
let awardsUpdated = false;
const combinedAwards = [...existingAwards];
for (const aw of newAwards) {
  if (!combinedAwards.includes(aw)) {
    combinedAwards.push(aw);
    awardsUpdated = true;
  }
}
const hasHugo = combinedAwards.includes("Nagroda Hugo");
const hasNebula = combinedAwards.includes("Nagroda Nebula");
const hasLocus = combinedAwards.includes("Nagroda Locus");
if (hasHugo && hasNebula && hasLocus && !combinedAwards.includes("Wszystkie")) {
  combinedAwards.push("Wszystkie");
  awardsUpdated = true;
}

console.log({ awardsUpdated, combinedAwards });
