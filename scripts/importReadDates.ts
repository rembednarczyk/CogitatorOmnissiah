/**
 * ONE-TIME tool: bulk-import read dates („Data przeczytania") from an exported
 * CSV into the Notion base. Not wired into the app — run it by hand:
 *
 *   npx tsx scripts/importReadDates.ts <plik.csv>            # DRY-RUN (preview, no writes)
 *   npx tsx scripts/importReadDates.ts <plik.csv> --apply    # write the matched dates
 *   npx tsx scripts/importReadDates.ts <plik.csv> --apply --overwrite  # also overwrite existing dates
 *
 * Needs NOTION_API_KEY + NOTION_DATABASE_ID in the environment (.env is loaded).
 * SAFETY: matches only books ALREADY in the base — it NEVER creates a row. By
 * default it also skips books that already carry a date. Dry-run first, read the
 * report, then re-run with --apply.
 *
 * The matching/parsing logic lives in `services/readDateImport.ts` (unit-tested);
 * this file is only the CSV read + Notion I/O + reporting wrapper.
 */
import "dotenv/config";
import { readFileSync } from "fs";
import { NotionAdapter } from "../notion.adapter";
import { parseImportCsv, buildReadDatePlan, MatchableBook } from "../services/readDateImport";

async function main() {
  const args = process.argv.slice(2);
  const csvPath = args.find((a) => !a.startsWith("--"));
  const apply = args.includes("--apply");
  const overwrite = args.includes("--overwrite");

  if (!csvPath) {
    console.error("Użycie: npx tsx scripts/importReadDates.ts <plik.csv> [--apply] [--overwrite]");
    process.exit(1);
  }
  if (!process.env.NOTION_API_KEY || !process.env.NOTION_DATABASE_ID) {
    console.error("Brak NOTION_API_KEY / NOTION_DATABASE_ID w środowisku (.env).");
    process.exit(1);
  }

  const rows = parseImportCsv(readFileSync(csvPath, "utf8"));
  console.log(`CSV: ${rows.length} wierszy z ${csvPath}`);

  const notion = new NotionAdapter(process.env.NOTION_API_KEY, process.env.NOTION_DATABASE_ID);
  await notion.init();
  console.log("Pobieram książki z bazy Notion...");
  const books = (await notion.queryAllBooks((c) => process.stdout.write(`\r  pobrano ${c}...`))) as MatchableBook[];
  process.stdout.write("\n");
  console.log(`Baza: ${books.length} książek.`);

  const plan = buildReadDatePlan(rows, books, { overwrite });

  console.log("\n=== PODGLĄD (dry-run) ===");
  console.log(`  Do zapisu:            ${plan.updates.length}`);
  console.log(`  Pominięte (mają datę): ${plan.skippedExisting.length}${overwrite ? " (overwrite ON — puste)" : ""}`);
  console.log(`  Bez dopasowania:       ${plan.unmatched.length} (spoza scope bazy — OK)`);
  console.log(`  Niejednoznaczne:       ${plan.ambiguous.length}`);
  console.log(`  Zła data (nieznany fmt): ${plan.unparseableDate.length}`);
  console.log(`  Zwinięte duplikaty:    ${plan.collapsed} (kilka wierszy → jedna książka, brana najwcześniejsza)`);

  const byUnique = plan.updates.filter((u) => u.matchedBy === "unique-title");
  if (byUnique.length) {
    console.log(`\n  ⚠ Dopasowane po samym (unikalnym) tytule — zerknij, czy słusznie (${byUnique.length}):`);
    for (const u of byUnique.slice(0, 40)) console.log(`     • ${u.csvTitle}  →  ${u.iso} (${u.dateRaw})`);
    if (byUnique.length > 40) console.log(`     ... i ${byUnique.length - 40} więcej`);
  }
  if (plan.ambiguous.length) {
    console.log(`\n  ⚠ Niejednoznaczne (pominięte):`);
    for (const a of plan.ambiguous.slice(0, 20)) console.log(`     • ${a.row.tytul} (${a.row.autor}) → ${a.bookIds.length} kandydatów`);
  }
  console.log(`\n  Przykłady do zapisu:`);
  for (const u of plan.updates.slice(0, 12)) console.log(`     • ${u.csvTitle}  →  ${u.iso}`);

  if (!apply) {
    console.log("\nDRY-RUN — nic nie zapisano. Dodaj --apply, by zapisać powyższe.");
    return;
  }

  console.log(`\n=== ZAPIS (${plan.updates.length}) ===`);
  let done = 0, failed = 0;
  for (const u of plan.updates) {
    try {
      await notion.setReadDate(u.id, u.iso);
      done++;
      process.stdout.write(`\r  zapisano ${done}/${plan.updates.length}...`);
    } catch (e: any) {
      failed++;
      console.error(`\n  BŁĄD dla ${u.csvTitle} (${u.id}): ${e?.message || e}`);
    }
  }
  process.stdout.write("\n");
  console.log(`Gotowe: ${done} zapisanych, ${failed} błędów.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
