/** Single source of truth for experience content. Edit this file, then share a link. */
export const config = {
  name: "Recipient",
  from: "Sender",
  message: "A personal birthday message goes here. Edit this in config.js.",
  dob: "",
  pages: [
    "Once upon a time began the story: chapters of a life well lived.",
    "The little spark never left. It still shines with attitude.",
    "Home is both stage and hiding place, all at once.",
    "Tonight the candles wait. Make a wish — then take the first slice.",
  ],
  favorites: [
    { label: "Family", text: "The one who makes a house feel like it knows your name." },
    { label: "Art", text: "Hands that turn ordinary hours into something that stays." },
    { label: "Spirit", text: "The little spark that never agreed to grow out." },
    { label: "Style", text: "Precision with a touch of mischief." },
    { label: "Presence", text: "You walk in already knowing the temperature of the room." },
    { label: "Homebody", text: "Home is your stage and your hiding place, both at once." },
    { label: "Thoughts", text: "You turn a maybe into a map, then still show up." },
  ],
  timeline: [
    { date: "Year one", title: "Arrival", text: "A new chapter begins." },
    { date: "The years", title: "Becoming", text: "Growing into who you are." },
    { date: "Tonight", title: "Celebration", text: "A sky of wishes sent your way." },
  ],
  finalWish: "May this year be kind and full of joy. Happy birthday.",
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
