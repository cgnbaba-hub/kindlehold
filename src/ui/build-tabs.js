// The build menu in four tabs, so a newcomer finds things: the town, raw goods, food, the army.
// ('road' stands for the road and lift-road buttons.)
export const BUILD_TABS = [
  { id: 'town', label: 'Town', ic: 'cottage', tip: 'Housing, Wells, stores and transport: Cottages, Storehouses, Donkey Stables and roads.', types: ['cottage', 'well', 'storehouse', 'donkeystable', 'road'] },
  { id: 'goods', label: 'Goods', ic: 'lodge', tip: 'Raw goods and tools: timber, stone, iron, salt and the Smithy.', types: ['lodge', 'quarry', 'mine', 'saltworks', 'smithy'] },
  { id: 'food', label: 'Food', ic: 'farm', tip: 'Food for every meal: farms, hunters, fishers, flour, bread and hot meals.', types: ['farm', 'hunter', 'fisher', 'mill', 'bakery', 'canteen'] },
  { id: 'army', label: 'Army', ic: 'barracks', tip: 'Soldiers and defences: the Barracks and Watchtowers.', types: ['barracks', 'tower'] },
];
/** The tab a building is found in. */
export const buildTabOf = (type) => (BUILD_TABS.find((t) => t.types.includes(type)) || BUILD_TABS[1]).id;
