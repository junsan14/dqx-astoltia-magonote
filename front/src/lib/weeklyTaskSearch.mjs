// Determine a shared hunting location from registered spawn data only.
export function resolveWeeklyTaskSearch(tasks, maps, spawns, monsters) {
  if (!tasks.length) return { task: null, combined: false };
  if (tasks.length === 1) return { task: tasks[0], combined: false };
  const matches = spawns.filter(spawn => {
    const map = maps.find(row => Number(row.id) === Number(spawn.map_id));
    const monster = monsters[spawn.monster_id];
    return map && monster && tasks.every(task =>
      Number(map.continent_id) === Number(task.continent_id) &&
      (task.search_mode !== "map" || Number(task.map_id) === Number(map.id)) &&
      (task.search_mode !== "system" || String(task.system_type || "").trim() === String(monster.system_type || "").trim())
    );
  });
  if (!matches.length) return { task: tasks[0], combined: false };
  const map = maps.find(row => Number(row.id) === Number(matches[0].map_id));
  const systemTask = tasks.find(task => task.search_mode === "system");
  return { combined: true, task: {
    ...tasks[0], continent_id: map.continent_id, map_id: map.id,
    search_mode: systemTask ? "system" : "map",
    system_type: systemTask?.system_type || "",
  }};
}
