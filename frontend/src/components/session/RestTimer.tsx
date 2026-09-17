"use client";

import { useEffect, useRef, useState } from "react";
import { formatClock } from "@/lib/format";
import { extendTimer, remainingSeconds, startTimer, type RestTimer as TimerT } from "@/lib/timer";
import { announce } from "@/lib/announce";
import { Pill } from "@/components/ui/Pill";

export type TimerState = TimerT & { set_id: string; rir_target: number; rir: number | null; first_time: boolean };

/** Timer di riposo (§2.2.4): foglio non modale, tempo a timestamp, RIR pre-selezionato, tre annunci in tutto. */
export function RestTimer({ timer, onChange, onClose, onRir }: { timer: TimerState; onChange: (t: TimerState) => void; onClose: () => void; onRir: (rir: number) => void }) {
  const [remaining, setRemaining] = useState(() => remainingSeconds(timer));
  const [closing, setClosing] = useState(false);
  const saidTen = useRef(false);
  const finished = useRef(false);

  useEffect(() => {
    const tick = () => {
      const r = remainingSeconds(timer);
      setRemaining(r);
      if (r <= 10 && r > 0 && !saidTen.current) {
        saidTen.current = true;
        announce("Dieci secondi");
      }
      if (r === 0 && !finished.current) {
        finished.current = true;
        announce("Riposo finito");
        if ("vibrate" in navigator) navigator.vibrate?.(200);
        window.setTimeout(() => {
          setClosing(true);
          window.setTimeout(onClose, 160);
        }, 2000);
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    const onVis = () => tick();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [timer, onClose]);

  return (
    <div className="timer" role="timer" aria-labelledby="timer-h" data-closing={closing || undefined}>
      <div className="timer-top">
        <div>
          <p id="timer-h" className="t-etichetta muted">
            Riposo
          </p>
          <p className="t-numero" aria-live="off">
            {formatClock(remaining)}
          </p>
        </div>
        <div className="row" style={{ flexWrap: "nowrap" }}>
          <button type="button" className="btn btn-secondary timer-btn" onClick={() => onChange({ ...timer, ...extendTimer(timer, 30) })}>
            +30″
          </button>
          <button
            type="button"
            className="btn btn-secondary timer-btn"
            onClick={() => {
              setClosing(true);
              window.setTimeout(onClose, 160);
            }}
          >
            Salta
          </button>
        </div>
      </div>
      <fieldset className="timer-rir">
        <legend className="t-corpo" style={{ marginBottom: "var(--space-1)" }}>
          {timer.first_time ? "Quante ne avevi ancora in canna (RIR)?" : "RIR"}
        </legend>
        <div className="pills">
          {[0, 1, 2, 3, 4].map((v) => (
            <Pill key={v} name={`rir-${timer.set_id}`} value={String(v)} variant="rir" checked={(timer.rir ?? timer.rir_target) === v} onChange={(x) => onRir(Number(x))}>
              {v === 4 ? "4+" : v}
            </Pill>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

export function newTimer(setId: string, restS: number, rirTarget: number, firstTime: boolean): TimerState {
  return { ...startTimer(restS), set_id: setId, rir_target: rirTarget, rir: null, first_time: firstTime };
}
