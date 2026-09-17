// Tipi derivati dal contratto congelato (/openapi.json → schema.d.ts, generato con openapi-typescript).
// Se il backend cambia, `pnpm types:api` + `pnpm typecheck` rompono il build, non la produzione.
import type { components } from "./schema";

type S = components["schemas"];

export type Note = S["Note"];
export type Citation = S["CitationOut"];
export type TokenPair = S["TokenPairOut"];
export type User = S["UserOut"];
export type Me = S["MeOut"];
export type Today = S["TodayOut"];
export type TodayOption = S["TodayOptionOut"];
export type SessionPreview = S["SessionPreviewOut"];
export type EmptyState = S["EmptyStateOut"];
export type OnboardingSchema = S["OnboardingSchemaOut"];
export type OnboardingIn = S["OnboardingIn"];
export type OnboardingOut = S["OnboardingOut"];
export type OnboardingStep = S["StepOut"];
export type OnboardingField = S["FieldOut"];
export type Session = S["SessionOut"];
export type SessionExercise = S["SessionExerciseOut"];
export type SetOut = S["SetOut"];
export type SetPatchIn = S["SetPatchIn"];
export type SetStatus = NonNullable<S["SetLoggedOut"]["status"]>;
export type ReadinessIn = S["ReadinessIn"];
export type ReadinessOut = S["ReadinessOut"];
export type Safety = S["SafetyOut"];
export type TodayOptionAction = S["TodayOptionAction"];
export type CloseIn = S["CloseIn"];
export type CloseSetIn = S["CloseSetIn"];
export type CloseOut = S["CloseOut"];
export type SyncOp = S["SyncOpIn"];
export type SyncOut = S["SyncOut"];
export type Plan = S["PlanOut"];
export type Week = S["WeekOut"];
export type WeekSession = S["WeekSessionOut"];
export type Proposal = S["ProposalOut"];
export type ProposalPatch = S["ProposalPatchIn"];
export type Summary = S["SummaryOut"];
export type ChatMessage = S["ChatMessageOut"];
export type ChatBlock = ChatMessage["blocks"][number];
export type ParagraphBlock = S["ParagraphBlock"];
export type OptionsBlock = S["OptionsBlock"];
export type PlanChangeBlock = S["PlanChangeBlock"];
export type SafetyBlock = S["SafetyBlock"];
export type PaywallBlock = S["PaywallBlock"];
export type OptionItem = S["OptionItem"];
export type ChatQuota = S["app__schemas__chat__ChatQuotaOut"];
export type ChatTexts = S["ChatTextsOut"];
export type Consistency = S["ConsistencyOut"];
export type ConsistencyDay = S["ConsistencyDayOut"];
export type ProgressExercise = S["ProgressExerciseOut"];
export type ProgressHistory = S["ProgressHistoryOut"];
export type Founders = S["FoundersOut"];
export type Prices = S["PricesOut"];
export type Price = S["PriceOut"];
export type CheckoutIn = S["CheckoutIn"];
export type PortalIn = S["PortalIn"];
export type WithdrawOut = S["WithdrawOut"];
export type ExportOut = S["ExportOut"];
export type EventIn = S["EventIn"];
export type KnowledgeExercise = S["ExerciseOut"];
export type Highlight = S["HighlightOut"];

export type SseEvent =
  | { type: "delta"; text: string }
  | { type: "block"; block: ChatBlock }
  | { type: "done"; message: ChatMessage };
