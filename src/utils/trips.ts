type tripTimelineType = {
  // three fields, the tripNumber, the Trip title, and the Trip Desc
  tripNumber: number;
  tripTitle: string;
  tripDesc: string;
};

/**
 *
 * 1) Mexico
 * 2) Spain
 * 3) Mexico Again
 * 4) Buenos Aires
 * 5) Turkey Greece Italy
 * 6) Colombia Panama Guatemala
 */

const tripTimeline: tripTimelineType[] = [
  {
    tripNumber: 1,
    tripTitle: "Mexico",
    tripDesc: "Trip to Mexico",
  },
  {
    tripNumber: 2,
    tripTitle: "Spain",
    tripDesc: "Trip to Spain",
  },
  {
    tripNumber: 3,
    tripTitle: "Mexico Again",
    tripDesc: "Trip to Mexico Again",
  },
  {
    tripNumber: 4,
    tripTitle: "Buenos Aires",
    tripDesc: "Trip to Buenos Aires",
  },
  {
    tripNumber: 5,
    tripTitle: "Turkey Greece Italy",
    tripDesc: "Trip to Turkey, Greece and Italy",
  },
  {
    tripNumber: 6,
    tripTitle: "Colombia Panama Guatemala",
    tripDesc: "Trip to Colombia, Panama and Guatemala",
  },
];

const listOfCountries = [
  "Mexico",
  "Spain",
  "Argentina",
  "Turkey",
  "Greece",
  "Italy",
  "Colombia",
  "Panama",
  "Guatemala",
]
