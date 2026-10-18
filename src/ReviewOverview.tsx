import { currentAnalysis, isPastedReview, type Review } from '../shared/review';
import { decisionIsCurrent } from '../shared/service';
import { decisionLabels, reviewNextStep, reviewProgress, reviewQuestions, type ReviewTab } from './review-presentation';

export function ReviewOverview({ review: r, readOnly, openTab, draftTab }: { review: Review; readOnly: boolean; openTab: (tab: ReviewTab) => void; draftTab?: ReviewTab }) {
  const next = reviewNextStep(r, readOnly);
  const progress = reviewProgress(r);
  const questions = reviewQuestions(r);
  const currentDecision = currentAnalysis(r) && decisionIsCurrent(r);
  const values = r.service?.values;
  return <section className="review-overview" aria-label="Saved review overview">
    <section className="review-next-step"><p className="eyebrow">{draftTab ? 'WORK IN PROGRESS' : 'NEXT STEP'}</p><h3>{draftTab ? 'Continue your unsaved draft' : next.title}</h3>
      <p>{draftTab ? 'Your draft is kept in this tab. The overview below describes the saved record; save or discard the draft before another change.' : next.description}</p>
      {draftTab ? <button type="button" onClick={() => openTab(draftTab)}>Return to draft</button> : next.tab && <button type="button" onClick={() => openTab(next.tab!)}>{next.action}</button>}
    </section>
    <section><h3>District summary</h3><p className="subtle">{r.decision ? currentDecision ? `Saved decision: ${decisionLabels[r.decision.outcome]}.` : 'Earlier district wording — a new decision is needed.' : 'No district decision recorded.'}</p>
      <p>{r.decision?.summary || 'Record a district summary with the decision in Publish & Documents.'}</p>
      {r.decision?.conditions && <p><strong>Decision conditions:</strong> {r.decision.conditions}</p>}
      {values && <><dl className="review-use-facts"><div><dt>Grade scope</dt><dd>{values.grades || 'Not recorded'}</dd></div><div><dt>Student data</dt><dd>{values.dataUse === 'unknown' ? 'Not confirmed' : values.dataUse === 'no_student_data' ? 'No student data recorded' : values.dataCategories || 'Categories not recorded'}</dd></div></dl>
        <p><strong>Recorded use conditions:</strong> {values.approvedWhen || 'Not recorded'}</p><button type="button" className="secondary" onClick={() => openTab('classification')}>Inspect use conditions and classification</button></>}
    </section>
    <section><h3>Evidence review</h3>{isPastedReview(r) ? <dl className="review-progress"><div><dt>Reviewed and resolved</dt><dd>{progress.resolved} / {progress.total}</dd></div><div><dt>Saved, unresolved</dt><dd>{progress.unresolved}</dd></div><div><dt>Not yet reviewed</dt><dd>{progress.unreviewed}</dd></div></dl> : <p>Bundled synthetic analysis. Its findings are demonstration output; they do not constitute a human district decision.</p>}
      <p className="subtle">Policy quotations are source evidence. Suggestions are interpretations to review. Scores are calculated from the adopted rubric. District decisions and use conditions are recorded separately.</p>
      <h4>Open questions in saved findings{questions.length > 0 && ` (${questions.length})`}</h4>
      {questions.length ? <ul className="review-questions">{questions.slice(0, 3).map(q => <li key={`${q.measureId}:${q.question}`}><strong>{q.label}</strong><p>{q.question}</p></li>)}</ul> : <p>{currentAnalysis(r) ? 'No open questions recorded in the current findings.' : 'No follow-up questions saved yet. Unreviewed measures and missing documents still need attention.'}</p>}
      {questions.length > 3 && <details><summary>Show {questions.length - 3} more saved questions</summary><ul className="review-questions">{questions.slice(3).map(q => <li key={`${q.measureId}:${q.question}`}><strong>{q.label}</strong><p>{q.question}</p></li>)}</ul></details>}
      <button type="button" className="secondary" onClick={() => openTab('compliance')}>Inspect findings, sources and suggestions</button>
    </section>
  </section>;
}
