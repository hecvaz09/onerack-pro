export function colorForCategory(category: string | null): string {
 const c=(category || "").toLowerCase();
 if(c.includes("switch") || c.includes("network")) return "#51472d";
 if(c.includes("server") || c.includes("chassis") || c.includes("compute")) return "#2d4d3c";
 return "#3b3b40";
}
