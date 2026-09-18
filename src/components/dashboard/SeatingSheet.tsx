import { useMemo } from "react";
import { fmtDate } from "../../lib/data";
import { useApp } from "../../lib/store";
import { seatingManifest } from "../../lib/seating";

/**
 * The printable seating chart.
 *
 * Lives in the DOM but is invisible on screen; @media print in index.css hides
 * the app and reveals this. Printing to PDF that way keeps real vector text —
 * a rasterising library would add a large dependency and make guest names
 * fuzzy at exactly the size a caterer needs to read them.
 *
 * Deliberately black on white with no brand colour: this gets printed on
 * whatever is in the venue office, and ink is not free.
 */
export default function SeatingSheet() {
  const { db } = useApp();
  const m = useMemo(() => seatingManifest(db.tables, db.guests), [db.tables, db.guests]);
  const printedOn = new Date().toLocaleDateString(undefined, {
    year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div id="seating-sheet" aria-hidden="true">
      <header className="sheet-head">
        <h1>{db.wedding.names || "Seating plan"}</h1>
        <p>
          {db.wedding.date ? fmtDate(db.wedding.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : ""}
          {db.wedding.venue ? ` · ${db.wedding.venue}` : ""}
          {db.wedding.location ? `, ${db.wedding.location}` : ""}
        </p>
        <p className="sheet-sub">
          {m.totals.tables} tables · {m.totals.seated} seated
          {m.totals.unassignedConfirmed > 0 && ` · ${m.totals.unassignedConfirmed} confirmed still to seat`}
        </p>
      </header>

      {/* The kitchen sheet first: it is the page a caterer actually keeps. */}
      {(m.meals.length > 0 || m.dietary.length > 0) && (
        <section className="sheet-block">
          <h2>For the kitchen</h2>
          {m.meals.length > 0 && (
            <ul className="sheet-inline">
              {m.meals.map((x) => (
                <li key={x.label}>
                  <strong>{x.count}</strong> {x.label}
                </li>
              ))}
            </ul>
          )}
          {m.dietary.length > 0 && (
            <table className="sheet-table">
              <thead>
                <tr><th>Dietary</th><th>Guests</th></tr>
              </thead>
              <tbody>
                {m.dietary.map((d) => (
                  <tr key={d.note}>
                    <td className="nowrap"><strong>{d.note}</strong> ({d.names.length})</td>
                    <td>{d.names.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      <section className="sheet-block">
        <h2>Tables</h2>
        <div className="sheet-tables">
          {m.tables.map((t) => (
            <div key={t.id} className="sheet-card">
              <h3>
                {t.name}
                <span className="sheet-count">
                  {t.seated.length}/{t.capacity}
                  {t.over && " — OVER CAPACITY"}
                </span>
              </h3>
              {t.seated.length === 0 ? (
                <p className="sheet-empty">No one seated yet</p>
              ) : (
                <ol>
                  {t.seated.map((s, i) => (
                    <li key={`${s.name}-${i}`}>
                      {s.name}
                      {s.isPlusOne && <span className="sheet-tag">+1</span>}
                      {s.meal && <span className="sheet-meal"> · {s.meal}</span>}
                      {s.dietary && <span className="sheet-diet"> · {s.dietary}</span>}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ))}
        </div>
      </section>

      {m.unassigned.length > 0 && (
        <section className="sheet-block">
          {/* This count includes guests who have not replied, so it is larger
              than the "confirmed still to seat" figure in the header. Saying so
              here stops the two numbers reading as a contradiction. */}
          <h2>Not seated yet ({m.unassigned.length})</h2>
          <p className="sheet-note">
            Includes guests who have not replied yet — {m.totals.unassignedConfirmed} of these have confirmed.
          </p>
          <p className="sheet-names">
            {m.unassigned.map((s) => s.name).join(" · ")}
          </p>
        </section>
      )}

      <footer className="sheet-foot">
        Printed {printedOn} · Luma
      </footer>
    </div>
  );
}
