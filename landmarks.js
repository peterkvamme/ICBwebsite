// Starter Gull Lake landmark list.
// Verify and refine these coordinates before launch.
// Tip: In Google Maps, right-click a location and copy lat/lng.

window.BOAT_LANDMARKS = [
  { name: "Zorbaz on Gull Lake", label: "near Zorbaz", lat: 46.4800, lng: -94.3660 },
  { name: "Bar Harbor", label: "near Bar Harbor", lat: 46.4370, lng: -94.3670 },
  { name: "Grand View Lodge", label: "near Grand View Lodge", lat: 46.4990, lng: -94.3160 },
  { name: "Madden's on Gull Lake", label: "near Madden's", lat: 46.3980, lng: -94.3600 },
  { name: "Cragun's Resort", label: "near Cragun's", lat: 46.3910, lng: -94.3490 },
  { name: "Quarterdeck Resort", label: "near Quarterdeck", lat: 46.4550, lng: -94.3550 },
  { name: "Gull Lake Dam", label: "near Gull Lake Dam", lat: 46.3860, lng: -94.3130 },
  { name: "Wilson Bay", label: "in Wilson Bay", lat: 46.4640, lng: -94.3350 },
  { name: "Steamboat Bay", label: "in Steamboat Bay", lat: 46.4070, lng: -94.3660 },
  { name: "Gull Point", label: "near Gull Point", lat: 46.4250, lng: -94.3380 },
  { name: "Sandy Point", label: "near Sandy Point", lat: 46.4750, lng: -94.3500 },
  { name: "Main Lake", label: "on the main lake", lat: 46.4450, lng: -94.3400 }
];

window.BOAT_AREAS = [
  // Areas are polygons. Add/edit these later for more natural location labels.
  // The code uses these first, then falls back to nearest landmark.
  {
    name: "Steamboat Bay",
    label: "in Steamboat Bay",
    polygon: [
      [46.3900, -94.3850],
      [46.4250, -94.3850],
      [46.4250, -94.3450],
      [46.3900, -94.3450]
    ]
  },
  {
    name: "Wilson Bay",
    label: "in Wilson Bay",
    polygon: [
      [46.4500, -94.3550],
      [46.4800, -94.3550],
      [46.4800, -94.3150],
      [46.4500, -94.3150]
    ]
  }
];
