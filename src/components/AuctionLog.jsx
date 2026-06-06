import { TEAM_NAMES, getTier } from "../constants";

function fmt(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function AuctionLog({ history }) {
  if (history.length === 0) {
    return (
      <div className="auction-log">
        <div className="log-title">Auction Log</div>
        <div className="log-empty">No sales recorded yet</div>
      </div>
    );
  }

  return (
    <div className="auction-log">
      <div className="log-title">
        Auction Log
        <span className="log-count">{history.length}</span>
      </div>
      <ul className="log-list">
        {[...history].reverse().map((entry, i) => {
          const tier = getTier(entry.champProb ?? 0);
          const num  = history.length - i;
          return (
            <li key={entry.ts} className="log-entry">
              <span className="log-num">#{num}</span>
              <span className="tier-dot" style={{ background: tier.color }} />
              <span className="log-team">{entry.team}</span>
              <span className="log-arrow">→</span>
              <span className="log-syndicate">{entry.syndicate}</span>
              <span className="log-price">${entry.price.toLocaleString()}</span>
              <span className="log-time">{fmt(entry.ts)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
