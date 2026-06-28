import { buildV130ExecutiveNarrative, v130GuidedUatSteps, v130MaturityLabels, v130RoleCoachPrompts, v130WorkbenchCards } from '../../lib/v130ExecutivePolish';

export interface ExecutivePolishWorkbenchProps {
  title?: string;
  compact?: boolean;
}

export function ExecutivePolishWorkbench({ title = 'Executive UX Polish Workbench', compact = false }: ExecutivePolishWorkbenchProps) {
  const visibleCards = compact ? v130WorkbenchCards.slice(0, 4) : v130WorkbenchCards;

  return (
    <section className="v130-workbench" aria-label={title}>
      <header className="v130-workbench__header">
        <div>
          <p className="v130-workbench__eyebrow">v13.0 controlled pilot polish</p>
          <h2>{title}</h2>
          <p>{buildV130ExecutiveNarrative()}</p>
        </div>
      </header>

      <div className="v130-workbench__grid">
        {visibleCards.map((card) => (
          <article className="v130-workbench__card" key={card.key}>
            <div className="v130-workbench__card-head">
              <span>{v130MaturityLabels[card.maturity]}</span>
              <strong>{card.arabicTitle}</strong>
            </div>
            <h3>{card.title}</h3>
            <p>{card.headline}</p>
            <dl>
              <div>
                <dt>Executive question</dt>
                <dd>{card.executiveQuestion}</dd>
              </div>
              <div>
                <dt>Next best action</dt>
                <dd>{card.nextBestAction}</dd>
              </div>
              <div>
                <dt>Proof signal</dt>
                <dd>{card.proofSignal}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>

      {!compact && (
        <div className="v130-workbench__support-grid">
          <section>
            <h3>Guided UAT focus</h3>
            <ol>
              {v130GuidedUatSteps.map((step) => (
                <li key={step.id}>
                  <strong>{step.id}</strong> — {step.actor}: {step.expectedResult}
                </li>
              ))}
            </ol>
          </section>
          <section>
            <h3>Role coach prompts</h3>
            <ul>
              {v130RoleCoachPrompts.map((prompt) => (
                <li key={prompt.role}>
                  <strong>{prompt.role}</strong>: {prompt.prompt}
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </section>
  );
}

export default ExecutivePolishWorkbench;
