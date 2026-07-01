const navItems = ["Today", "Parlays", "Grading", "Backtest", "Model Lab", "Data Health"];

export function App() {
  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Primary">
        <div>
          <p className="eyebrow">Personal Model Lab</p>
          <h1>MLB Edge Lab</h1>
        </div>
        <nav>
          {navItems.map((item) => (
            <button key={item} type="button" className={item === "Today" ? "active" : ""}>
              {item}
            </button>
          ))}
        </nav>
      </aside>
      <section className="workspace">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">Today</p>
            <h2>Daily Slate Intelligence</h2>
          </div>
          <div className="model-pill">Model v1.0.0</div>
        </header>
        <section className="empty-panel">
          <h3>Engine foundation is coming online.</h3>
          <p>
            The first build path is odds math, versioned model config, explainable picks,
            parlay grading, backtesting, and calibration before live API wiring.
          </p>
        </section>
      </section>
    </main>
  );
}

