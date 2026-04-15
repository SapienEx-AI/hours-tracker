import type { RefObject } from 'react';
import type { LoggingMode, Project } from '@/schema/types';
import { Button } from '@/ui/components/Button';
import { Banner } from '@/ui/components/Banner';
import { type FormState } from './form-helpers';
import type { FlashTone } from './FieldFlash';
import {
  ActivityField,
  BucketField,
  DateField,
  DescriptionField,
  HoursField,
  ProjectField,
  RateField,
  StatusField,
  type FieldProps,
} from './LogFormFields';

type Props = {
  form: FormState;
  setForm: (next: FormState | ((f: FormState) => FormState)) => void;
  activeProjects: Project[];
  projectRef: RefObject<HTMLSelectElement>;
  toast: string | null;
  prefillHint: string | null;
  onClearPrefill: () => void;
  mutationError: Error | null;
  saving: boolean;
  canSave: boolean;
  onSave: () => void;
  loadAnimNonce: number;
  loadFlashFields: ReadonlySet<string>;
  loadFlashTone: FlashTone;
  loggingMode: LoggingMode;
};

export function LogForm(props: Props): JSX.Element {
  const {
    form,
    setForm,
    activeProjects,
    projectRef,
    toast,
    prefillHint,
    onClearPrefill,
    mutationError,
    saving,
    canSave,
    onSave,
    loadAnimNonce,
    loadFlashFields,
    loadFlashTone,
    loggingMode,
  } = props;

  const selectedProject = activeProjects.find((p) => p.id === form.projectId);
  const activeBuckets =
    selectedProject?.buckets.filter((b) => b.status !== 'archived') ?? [];

  const fp: FieldProps = {
    form,
    setForm,
    flashFields: loadFlashFields,
    nonce: loadAnimNonce,
    tone: loadFlashTone,
  };

  const isEffortMode = loggingMode === 'effort';
  const headerTitle = isEffortMode ? 'Log activity' : 'Log hours';

  return (
    <div className="relative flex-1 max-w-[480px]">
      {loadAnimNonce > 0 && (
        <div
          key={loadAnimNonce}
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl z-10"
        >
          <div
            className="
              absolute -top-4 -bottom-4 right-0 w-64 anim-assist-sweep
              bg-gradient-to-l from-transparent via-partner-cyan/40 to-transparent
              blur-md
            "
          />
        </div>
      )}

      <div className="flex flex-col gap-4">
        <h1 className="font-display text-2xl">{headerTitle}</h1>
        {toast && <Banner variant="success">{toast}</Banner>}

        <DateField {...fp} />
        <ProjectField {...fp} activeProjects={activeProjects} projectRef={projectRef} />

        {isEffortMode && <ActivityField {...fp} />}
        <HoursField {...fp} />
        {!isEffortMode && <ActivityField {...fp} />}

        <BucketField {...fp} activeBuckets={activeBuckets} />

        {isEffortMode ? (
          <details className="glass-input rounded-xl p-3">
            <summary className="text-xs font-mono uppercase tracking-wider text-slate-500 cursor-pointer select-none">
              Advanced (billable status, rate)
            </summary>
            <div className="mt-3 flex flex-col gap-4">
              <StatusField {...fp} />
              <RateField {...fp} />
            </div>
          </details>
        ) : (
          <>
            <StatusField {...fp} />
            <RateField {...fp} />
          </>
        )}

        <DescriptionField {...fp} />

        {prefillHint && (
          <div className="text-xs text-slate-500">
            Prefilled from <span className="italic">{prefillHint}</span>{' '}
            <button
              type="button"
              onClick={onClearPrefill}
              className="underline text-slate-600"
            >
              clear
            </button>
          </div>
        )}

        {mutationError && <Banner variant="error">{mutationError.message}</Banner>}

        <Button onClick={onSave} disabled={saving || !canSave}>
          {saving ? 'Saving…' : 'Save (⌘↵)'}
        </Button>
      </div>
    </div>
  );
}
