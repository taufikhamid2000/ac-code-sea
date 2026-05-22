export type SceneId =
  | "prologue"
  | "chamber"
  | "visitation"
  | "rewind"
  | "council"
  | "end_blood"
  | "end_chains"
  | "end_rally"
  | "end_solo";

export type Choice = {
  label: string;
  next: SceneId;
};

export type Scene = {
  id: SceneId;
  chapter?: string;
  title?: string;
  image: string;
  body: string[];
  choices?: Choice[];
  isEnding?: boolean;
  endingTitle?: string;
};

export const START: SceneId = "prologue";

export const scenes: Record<SceneId, Scene> = {
  prologue: {
    id: "prologue",
    chapter: "Chapter VI",
    title: "The Whisper at Court",
    image: "/5.png",
    body: [
      "Malacca, 1456. The Sultan sleeps, but the palace does not.",
      "Si Kitol — youngest of the court, Templar in shadow — moves through the halls with a smile that has fooled everyone but you.",
      "Tonight you learned his plan. By morning, the Sultan will be dead, and the Brotherhood with him.",
    ],
    choices: [{ label: "Return to your chamber.", next: "chamber" }],
  },

  chamber: {
    id: "chamber",
    chapter: "Chapter VI",
    title: "The Keris",
    image: "/9.png",
    body: [
      "A single candle. The Keris Taming Sari rests across your knees.",
      "You can feel it — not the steel, but what hums beneath the steel. ISU work. A relic that does not obey time.",
      "Lekir knocks. You send him away. You are alone with the blade and with what you might become.",
    ],
    choices: [{ label: "Take the blade in both hands.", next: "visitation" }],
  },

  visitation: {
    id: "visitation",
    chapter: "Chapter VI",
    title: "Two Voices",
    image: "/6.png",
    body: [
      "The room bends. Two figures stand in the air where no figures should stand.",
      "Juno: \"Reach back, Tuah. Undo him before he was. Your Sultan lives. Your brothers never know fear.\"",
      "Minerva: \"Pull one thread and you unweave the world. Some doors close behind you, warrior. This is one of them.\"",
      "The Keris is warm. The choice is yours.",
    ],
    choices: [
      { label: "Trust Juno. Rewind the night.", next: "rewind" },
      { label: "Heed Minerva. Face him with steel and breath.", next: "council" },
    ],
  },

  rewind: {
    id: "rewind",
    chapter: "Chapter VI",
    title: "The Rewind",
    image: "/3.png",
    body: [
      "The candle gutters. The walls fold. You step out of the chamber into yesterday.",
      "Si Kitol is alive and laughing in his quarters, courtiers around him. He has not yet betrayed anyone. He has only intended to.",
      "Your Keris is in your hand. The hour is yours.",
    ],
    choices: [
      { label: "End him. A blade from the dark.", next: "end_blood" },
      { label: "Take him. Chains, not blood.", next: "end_chains" },
    ],
  },

  council: {
    id: "council",
    chapter: "Chapter VI",
    title: "The Council",
    image: "/2.png",
    body: [
      "You leave the Keris on its cloth. You walk out into the courtyard where the brotherhood trains by lantern-light.",
      "Jebat sees your face first. He always does. The others follow.",
      "There is a way to end Si Kitol before sunrise that does not cost the world its shape. But you must decide how to begin.",
    ],
    choices: [
      { label: "Tell Jebat everything. Move together.", next: "end_rally" },
      { label: "Tell no one. Carry it alone.", next: "end_solo" },
    ],
  },

  end_blood: {
    id: "end_blood",
    chapter: "Chapter VI",
    title: "Aftermath",
    endingTitle: "An Ending in Blood",
    image: "/4.png",
    body: [
      "Si Kitol dies before his treachery is born. The court wakes to a corpse and questions no one can answer.",
      "Jebat finds you on the ramparts. He does not need a confession. He has felt the world wrong since dawn.",
      "\"You used it,\" he says. Not a question.",
      "You do not answer. The Brotherhood does not survive the silence between you.",
      "Hang Tuah carries this. The wheel of Malacca keeps turning, but it turns crooked now, and only you can feel the wobble.",
    ],
    isEnding: true,
  },

  end_chains: {
    id: "end_chains",
    chapter: "Chapter VI",
    title: "Aftermath",
    endingTitle: "An Ending in Chains",
    image: "/8.png",
    body: [
      "You take him alive. You hide him beneath the palace, where no light and no court can find him.",
      "Malacca wakes to a missing man and a thousand whispers. The Sultan is safe. The kingdom prospers.",
      "But Lekir is not a fool. Neither is Jebat. They piece it together. They come to you.",
      "\"A small price,\" you tell them, \"for paradise.\"",
      "They look at you the way men look at strangers. Hang Tuah carries this. The Brotherhood is changed forever.",
    ],
    isEnding: true,
  },

  end_rally: {
    id: "end_rally",
    chapter: "Chapter VI",
    title: "Aftermath",
    endingTitle: "A Brotherhood Held",
    image: "/7.png",
    body: [
      "Jebat listens. Jebat believes. By dawn the five of you have Si Kitol pinned by the truth of his own letters — taken from his chamber while he slept.",
      "The Sultan exiles him. The Templars lose their hand at court. No relics were touched. No time was bent.",
      "But Jebat saw the Keris on its cloth. He knows what you almost did. He does not speak of it. He does not need to.",
      "Hang Tuah carries this too: that the brothers who would die for you have, for the first time, a thing they cannot ask you about.",
    ],
    isEnding: true,
  },

  end_solo: {
    id: "end_solo",
    chapter: "Chapter VI",
    title: "Aftermath",
    endingTitle: "The Weight Alone",
    image: "/1.png",
    body: [
      "You move that night. Alone. You leave Si Kitol bound and gagged at the Bendahara's door with the letters that damn him.",
      "By midday the court knows. The Sultan is safe. No one knows it was you.",
      "Your brothers ask. You answer with weather and trade and the price of pepper.",
      "Years later, on a rampart, with siege smoke on the horizon, Lekir will ask if you ever regretted not telling them.",
      "Hang Tuah carries this. He will not lie. He will not answer either.",
    ],
    isEnding: true,
  },
};
