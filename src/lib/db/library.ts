import type { Equipment, MuscleGroup } from "./schema";

export interface LibraryExercise {
  /** id stabile: il seed deve poter riconoscere cio' che ha gia' messo */
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  equipment: Equipment;
  secondaryMuscles: MuscleGroup[];
  isBodyweight: boolean;
}

type Row = [
  name: string,
  muscleGroup: MuscleGroup,
  equipment: Equipment,
  secondary?: MuscleGroup[],
  isBodyweight?: boolean,
];

const ROWS: Row[] = [
  // ---------------------------------------------------------------- PETTO
  ["Panca piana con bilanciere", "chest", "barbell", ["shoulders", "arms"]],
  ["Panca inclinata con bilanciere", "chest", "barbell", ["shoulders", "arms"]],
  ["Panca declinata con bilanciere", "chest", "barbell", ["arms"]],
  ["Panca stretta con bilanciere", "arms", "barbell", ["chest", "shoulders"]],
  ["Panca piana con manubri", "chest", "dumbbell", ["shoulders", "arms"]],
  ["Panca inclinata con manubri", "chest", "dumbbell", ["shoulders", "arms"]],
  ["Croci su panca piana con manubri", "chest", "dumbbell", ["shoulders"]],
  ["Croci su panca inclinata con manubri", "chest", "dumbbell", ["shoulders"]],
  ["Croci ai cavi", "chest", "cable", ["shoulders"]],
  ["Spinte ai cavi in piedi", "chest", "cable", ["shoulders", "arms"]],
  ["Chest press alla macchina", "chest", "machine", ["shoulders", "arms"]],
  ["Pectoral machine", "chest", "machine", []],
  ["Piegamenti sulle braccia", "chest", "bodyweight", ["shoulders", "arms", "core"], true],
  ["Dip alle parallele", "chest", "bodyweight", ["arms", "shoulders"], true],

  // ---------------------------------------------------------------- DORSO
  ["Stacco da terra", "back", "barbell", ["legs", "core"]],
  ["Rematore con bilanciere", "back", "barbell", ["arms"]],
  ["Rematore con bilanciere presa inversa", "back", "barbell", ["arms"]],
  ["Rematore con manubrio a un braccio", "back", "dumbbell", ["arms"]],
  ["Rematore con manubri a busto flesso", "back", "dumbbell", ["arms", "shoulders"]],
  ["Trazioni alla sbarra", "back", "bodyweight", ["arms"], true],
  ["Trazioni presa supina", "back", "bodyweight", ["arms"], true],
  ["Lat machine avanti", "back", "cable", ["arms"]],
  ["Lat machine presa stretta", "back", "cable", ["arms"]],
  ["Pulley basso", "back", "cable", ["arms"]],
  ["Pullover ai cavi", "back", "cable", ["chest"]],
  ["Rematore alla macchina", "back", "machine", ["arms"]],
  ["Iperestensioni", "back", "bodyweight", ["legs", "core"], true],
  ["Scrollate con bilanciere", "back", "barbell", ["shoulders"]],
  ["Scrollate con manubri", "back", "dumbbell", ["shoulders"]],

  // ---------------------------------------------------------------- SPALLE
  ["Military press con bilanciere", "shoulders", "barbell", ["arms", "core"]],
  ["Lento avanti con manubri", "shoulders", "dumbbell", ["arms"]],
  ["Arnold press", "shoulders", "dumbbell", ["arms"]],
  ["Alzate laterali con manubri", "shoulders", "dumbbell", []],
  ["Alzate laterali ai cavi", "shoulders", "cable", []],
  ["Alzate frontali con manubri", "shoulders", "dumbbell", []],
  ["Alzate posteriori con manubri", "shoulders", "dumbbell", ["back"]],
  ["Rear delt ai cavi", "shoulders", "cable", ["back"]],
  ["Face pull ai cavi", "shoulders", "cable", ["back"]],
  ["Tirate al mento con bilanciere", "shoulders", "barbell", ["back", "arms"]],
  ["Shoulder press alla macchina", "shoulders", "machine", ["arms"]],

  // ---------------------------------------------------------------- GAMBE
  ["Squat con bilanciere", "legs", "barbell", ["core", "back"]],
  ["Front squat", "legs", "barbell", ["core"]],
  ["Goblet squat", "legs", "dumbbell", ["core"]],
  ["Squat bulgaro con manubri", "legs", "dumbbell", ["core"]],
  ["Affondi con manubri", "legs", "dumbbell", ["core"]],
  ["Step up con manubri", "legs", "dumbbell", ["core"]],
  ["Stacco rumeno con bilanciere", "legs", "barbell", ["back"]],
  ["Stacco a gambe tese con manubri", "legs", "dumbbell", ["back"]],
  ["Hip thrust con bilanciere", "legs", "barbell", ["core"]],
  ["Pressa per gambe", "legs", "machine", []],
  ["Hack squat", "legs", "machine", ["core"]],
  ["Leg extension", "legs", "machine", []],
  ["Leg curl sdraiato", "legs", "machine", []],
  ["Leg curl seduto", "legs", "machine", []],
  ["Abduzioni alla macchina", "legs", "machine", []],
  ["Adduzioni alla macchina", "legs", "machine", []],
  ["Calf raise in piedi", "legs", "machine", []],
  ["Calf raise seduto", "legs", "machine", []],

  // ---------------------------------------------------------------- BRACCIA
  ["Curl con bilanciere", "arms", "barbell", []],
  ["Curl con bilanciere EZ", "arms", "barbell", []],
  ["Curl con manubri", "arms", "dumbbell", []],
  ["Curl a martello", "arms", "dumbbell", []],
  ["Curl concentrato", "arms", "dumbbell", []],
  ["Curl alla panca Scott", "arms", "barbell", []],
  ["Curl ai cavi", "arms", "cable", []],
  ["French press con bilanciere EZ", "arms", "barbell", []],
  ["Estensioni sopra la testa con manubrio", "arms", "dumbbell", []],
  ["Push down ai cavi", "arms", "cable", []],
  ["Push down con corda", "arms", "cable", []],
  ["Kickback ai cavi", "arms", "cable", []],
  ["Dip alla panca", "arms", "bodyweight", ["chest", "shoulders"], true],

  // ---------------------------------------------------------------- CORE
  ["Crunch a terra", "core", "bodyweight", [], true],
  ["Sit up", "core", "bodyweight", [], true],
  ["Crunch ai cavi", "core", "cable", []],
  ["Plank", "core", "bodyweight", ["shoulders"], true],
  ["Plank laterale", "core", "bodyweight", [], true],
  ["Sollevamento gambe alla sbarra", "core", "bodyweight", [], true],
  ["Russian twist", "core", "bodyweight", [], true],
  ["Hollow hold", "core", "bodyweight", [], true],
  ["Mountain climber", "core", "bodyweight", ["legs"], true],
  ["Ab wheel", "core", "other", ["shoulders"], true],
];

function slug(name: string): string {
  return name
    .toLocaleLowerCase("it-IT")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Libreria precaricata: nomi in italiano, muscolo target e attrezzatura (spec §3.4). */
export const LIBRARY: LibraryExercise[] = ROWS.map(
  ([name, muscleGroup, equipment, secondary, isBodyweight]) => ({
    id: `lib-${slug(name)}`,
    name,
    muscleGroup,
    equipment,
    secondaryMuscles: secondary ?? [],
    isBodyweight: isBodyweight ?? false,
  }),
);

/** Si alza quando la libreria cambia: solo allora il seed torna a girare. */
export const LIBRARY_VERSION = 1;
export const LIBRARY_META_KEY = "seed.libraryVersion";
