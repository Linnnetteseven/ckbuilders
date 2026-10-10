import "server-only";

/** Full post bodies. Never imported by client code; served by /api/posts only. */
export const POST_BODIES: Record<string, Record<string, string>> = {
  "wanjiru-frames": {
    "kenyatta-ave":
      "At 6:40 the light comes down Kenyatta Avenue at a low angle and every hawker setting up throws a long shadow. I stand at the same corner every Tuesday. Most mornings nothing happens. The point is being there on the morning something does.",
    "contact-sheet-14":
      "Gikomba, roll 14. Frames 1–9 are the walk in, mostly too busy. Frame 17 is the keeper: a mitumba seller lifting a coat against the sun, the lining glowing. Frame 23 I nearly deleted for motion blur; it ended up being the one people ask about. Notes on exposure: f/8, 1/250, pushed one stop.",
    "print-vote-oct":
      "This month's shortlist: (1) Kenyatta Avenue 6:40, (2) Gikomba coat, (3) the boda rider in the rain on Moi Avenue. Reply with your number. The winner gets printed at 50×70 and one member gets the signed print.",
  },
  "otieno-builds": {
    "cells-101":
      "A cell is like a room you rent. Capacity is the size of the room, data is what you keep inside, the lock decides who holds the key, and the type script is the house rules. Every transaction moves out of old rooms and into new ones.",
    "type-id-lab":
      "1. Pick your first input. 2. Hash it together with the output index to get the Type ID. 3. Put that hash in your type script args. Common mistakes: hashing the wrong input, forgetting the output index is u64 little-endian, and adding a second output with the same type.",
  },
  "matatu-sound": {
    "route-46":
      "Track list: Kencom → Prestige → Yaya. 20 minutes of gengetone into amapiano, mixed live on a DDJ-400 in one take.",
    "stems-vol-3":
      "Stems vol. 3: drums (128 bpm), bass, lead vocal, crowd FX. Licensed for non-commercial remixes; tag me if you post one.",
  },
};
