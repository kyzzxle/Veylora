/**
 * Enhances every [data-quiz] on the page with instant feedback, a running
 * progress bar, a final score and a retry button.
 */

function initQuiz(quiz: HTMLElement) {
  if (quiz.dataset.ready) return;
  quiz.dataset.ready = 'true';

  const questions = [...quiz.querySelectorAll<HTMLLIElement>('.quiz-q')];
  const total = questions.length;
  const bar = quiz.querySelector<HTMLElement>('[data-progress-bar]');
  const progressText = quiz.querySelector<HTMLElement>('[data-progress-text]');
  const result = quiz.querySelector<HTMLElement>('[data-result]');
  const scoreEl = quiz.querySelector<HTMLElement>('[data-score]');
  const ring = quiz.querySelector<HTMLElement>('[data-score-ring]');
  const resultTitle = quiz.querySelector<HTMLElement>('[data-result-title]');
  const resultMsg = quiz.querySelector<HTMLElement>('[data-result-msg]');
  const retry = quiz.querySelector<HTMLButtonElement>('[data-retry]');

  let answered = 0;
  let correct = 0;

  function update() {
    if (bar) bar.style.width = `${(answered / total) * 100}%`;
    if (progressText) progressText.textContent = `${answered} of ${total} answered · ${correct} correct`;
    if (answered === total && result) {
      const pct = Math.round((correct / total) * 100);
      result.hidden = false;
      if (scoreEl) scoreEl.textContent = `${correct}/${total}`;
      ring?.style.setProperty('--pct', String(pct));
      if (resultTitle) {
        resultTitle.textContent =
          pct === 100 ? 'Perfect score!' : pct >= 80 ? 'Excellent work' : pct >= 50 ? 'Good effort' : 'Keep experimenting';
      }
      if (resultMsg) {
        resultMsg.textContent =
          pct === 100
            ? 'You answered every question correctly. Try changing the simulator settings to explore edge cases.'
            : `You scored ${pct}%. Review the explanations above, revisit the simulator and try again.`;
      }
    }
  }

  questions.forEach((li) => {
    const answer = Number(li.dataset.answer);
    const inputs = [...li.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
    const feedback = li.querySelector<HTMLDetailsElement>('.q-feedback');
    const verdict = li.querySelector<HTMLElement>('[data-verdict]');

    inputs.forEach((input) => {
      input.addEventListener('change', () => {
        if (li.classList.contains('is-answered')) return;
        li.classList.add('is-answered');
        const chosen = Number(input.value);
        const isRight = chosen === answer;
        answered++;
        if (isRight) correct++;

        inputs.forEach((inp, i) => {
          inp.disabled = true;
          const label = inp.closest('.q-option');
          if (i === answer) label?.classList.add('is-correct');
          else if (i === chosen) label?.classList.add('is-wrong');
        });
        if (verdict) {
          verdict.textContent = isRight ? 'Correct!' : 'Not quite.';
          verdict.className = `q-verdict ${isRight ? 'ok' : 'no'}`;
        }
        if (feedback) feedback.open = true;
        update();
      });
    });
  });

  retry?.addEventListener('click', () => {
    answered = 0;
    correct = 0;
    questions.forEach((li) => {
      li.classList.remove('is-answered');
      li.querySelectorAll<HTMLInputElement>('input').forEach((inp) => {
        inp.checked = false;
        inp.disabled = false;
      });
      li.querySelectorAll('.q-option').forEach((o) => o.classList.remove('is-correct', 'is-wrong'));
      const fb = li.querySelector<HTMLDetailsElement>('.q-feedback');
      if (fb) fb.open = false;
      const v = li.querySelector<HTMLElement>('[data-verdict]');
      if (v) v.textContent = '';
    });
    if (result) result.hidden = true;
    update();
    if (progressText) progressText.textContent = `0 of ${total} answered`;
    quiz.scrollIntoView({ behavior: 'smooth', block: 'start' });
    questions[0]?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
  });
}

document.querySelectorAll<HTMLElement>('[data-quiz]').forEach(initQuiz);
