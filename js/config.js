/** Single source of truth for experience content. Edit this file, then share a link. */
export const config = {
  name: "Varsha",
  from: "Jyotishudu",
  message: "The familywoman. The artist. The chinnapilla. The clips thrower. The attitude girl. The intlovert. The overthinker. All of you, always.",
  dob: "",
  pages: [
    "Once upon a time began Varsha: familywoman of the house, artist of the quiet hours.",
    "The chinnapilla never left. You still throw clips with full attitude.",
    "The intlovert keeps a whole universe indoors. The overthinker maps every star.",
    "Tonight the candles wait for you. Make a wish, Varsha — then take the first slice.",
  ],
  favorites: [
    { label: "Familywoman", text: "The one who makes a house feel like it knows your name." },
    { label: "Artist", text: "Hands that turn ordinary hours into something that stays." },
    { label: "Chinnapilla", text: "The little-girl spark that never agreed to grow out." },
    { label: "Clips thrower", text: "Precision mischief. You have been warned." },
    { label: "Attitude", text: "You walk in already knowing the temperature of the room." },
    { label: "Intlovert", text: "Home is your stage and your hiding place, both at once." },
    { label: "Overthinker", text: "You turn a maybe into a map, then still show up." },
  ],
  timeline: [
    { date: "18 Oct 2000", title: "You arrived", text: "A chinnapilla with a whole attitude already packed." },
    { date: "The years", title: "Becoming", text: "Artist, familywoman, overthinker — none of them a costume." },
    { date: "Tonight", title: "Eighteen October", text: "Jyotishudu sent a sky. The clips can wait till morning." },
  ],
  finalWish: "Varsha, may this year be kind to the intlovert and loud enough for the artist. Happy birthday.",
  musicSrc: "",
  theme: "rose",
};

export const THEMES = ["rose", "midnight", "royal", "sunset", "forest"];

export const LIMITS = {
  name: 24,
  from: 24,
  message: 280,
  dob: 10,
  theme: 16,
  page: 140,
  favoriteLabel: 18,
  favoriteText: 90,
  timelineDate: 20,
  timelineTitle: 24,
  timelineText: 90,
  finalWish: 160,
  wish: 140,
  payload: 1800,
};

export const STAGE_LIST = ["generator", "gift", "key", "storybook", "cake", "blow", "cut", "celebration", "message", "wish", "finale"];
