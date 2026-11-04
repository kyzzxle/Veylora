/**
 * Bind the control components (SliderControl, ChoiceControl, ToggleControl,
 * PresetButtons, Readout) inside one simulator root to your code.
 *
 *   const ui = controls(root);
 *   const speed = ui.range('speed', (v) => `${v} m/s`, (v) => (state.speed = v));
 *   ui.presets('speed', speed);
 *   ui.choice('mode', (v) => (state.mode = v));
 *   ui.readout('energy', '12 J', 'ok');
 */

export type Tone = 'ok' | 'warn' | 'bad' | null;

export interface RangeControl {
  readonly value: number;
  /** Set the slider. With notify=false the onChange callback is not called. */
  set(v: number, notify?: boolean): void;
  readonly input: HTMLInputElement;
}

export interface ChoiceControl<T extends string = string> {
  readonly value: T;
  set(v: T, notify?: boolean): void;
}

export interface ToggleControl {
  readonly value: boolean;
  set(v: boolean, notify?: boolean): void;
}

const paint = (input: HTMLInputElement) =>
  (window as unknown as { paintRange?: (i: HTMLInputElement) => void }).paintRange?.(input);

export function controls(root: HTMLElement) {
  const find = <T extends Element>(sel: string): T => {
    const el = root.querySelector<T>(sel);
    if (!el) throw new Error(`Simulator control not found: ${sel}`);
    return el;
  };
  const presetSyncs = new Map<string, () => void>();

  function range(name: string, format: (v: number) => string, onChange: (v: number) => void): RangeControl {
    const input = find<HTMLInputElement>(`input[type="range"][data-ctrl="${name}"]`);
    const out = root.querySelector<HTMLElement>(`[data-ctrl-out="${name}"]`);
    const show = (v: number) => {
      const text = format(v);
      if (out) out.textContent = text;
      input.setAttribute('aria-valuetext', text);
    };
    input.addEventListener('input', () => {
      const v = Number(input.value);
      show(v);
      onChange(v);
      presetSyncs.get(name)?.();
    });
    show(Number(input.value));
    return {
      get value() {
        return Number(input.value);
      },
      set(v, notify = true) {
        input.value = String(v);
        paint(input);
        show(Number(input.value));
        presetSyncs.get(name)?.();
        if (notify) onChange(Number(input.value));
      },
      input,
    };
  }

  function choice<T extends string>(name: string, onChange: (v: T) => void): ChoiceControl<T> {
    const inputs = [...root.querySelectorAll<HTMLInputElement>(`input[type="radio"][data-ctrl="${name}"]`)];
    if (!inputs.length) throw new Error(`Simulator choice not found: ${name}`);
    inputs.forEach((i) => i.addEventListener('change', () => i.checked && onChange(i.value as T)));
    return {
      get value() {
        return (inputs.find((i) => i.checked)?.value ?? inputs[0].value) as T;
      },
      set(v, notify = true) {
        inputs.forEach((i) => (i.checked = i.value === v));
        if (notify) onChange(v);
      },
    };
  }

  function toggle(name: string, onChange: (v: boolean) => void): ToggleControl {
    const input = find<HTMLInputElement>(`input[type="checkbox"][data-ctrl="${name}"]`);
    input.addEventListener('change', () => onChange(input.checked));
    return {
      get value() {
        return input.checked;
      },
      set(v, notify = true) {
        input.checked = v;
        if (notify) onChange(v);
      },
    };
  }

  /** Wire PresetButtons for a slider and keep their pressed state in sync. */
  function presets(name: string, ctl: RangeControl) {
    const buttons = [...root.querySelectorAll<HTMLButtonElement>(`[data-preset-for="${name}"]`)];
    const sync = () =>
      buttons.forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.value) === ctl.value)));
    buttons.forEach((b) => b.addEventListener('click', () => ctl.set(Number(b.dataset.value))));
    presetSyncs.set(name, sync);
    sync();
  }

  const readoutCache = new Map<string, HTMLElement | null>();
  /** Update a Readout's text (only touches the DOM when the text changes). */
  function readout(name: string, text: string, tone: Tone = null) {
    if (!readoutCache.has(name)) readoutCache.set(name, root.querySelector<HTMLElement>(`[data-readout="${name}"]`));
    const el = readoutCache.get(name);
    if (!el) return;
    if (el.textContent !== text) el.textContent = text;
    const cls = tone ? `tone-${tone}` : '';
    if (el.className !== cls) el.className = cls;
  }

  /** Show or hide every element matching a selector inside the simulator. */
  function showWhen(selector: string, visible: boolean) {
    root.querySelectorAll<HTMLElement>(selector).forEach((el) => (el.hidden = !visible));
  }

  return { range, choice, toggle, presets, readout, showWhen };
}
