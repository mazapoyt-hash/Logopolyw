// Classic Monopoly board data — prices, rents, groups, positions.
// rent = [base, 1house, 2house, 3house, 4house, hotel]

const GROUP_COLORS = {
  brown:    '#8B4B33',
  lightblue:'#AAE0FA',
  pink:     '#D93A96',
  orange:   '#F0921E',
  red:      '#ED1B24',
  yellow:   '#FEF200',
  green:    '#1FA24B',
  blue:     '#0072BB',
  railroad: '#2b2b2b',
  utility:  '#8a8a8a'
};

const BOARD = [
  { i:0,  type:'go',      name:'СТАРТ' },
  { i:1,  type:'property',name:'Mediterranean Avenue', group:'brown', price:60,  rent:[2,10,30,90,160,250],  houseCost:50,  mortgage:30 },
  { i:2,  type:'chest',   name:'Общественная казна' },
  { i:3,  type:'property',name:'Baltic Avenue', group:'brown', price:60,  rent:[4,20,60,180,320,450],  houseCost:50,  mortgage:30 },
  { i:4,  type:'tax',     name:'Подоходный налог', amount:200 },
  { i:5,  type:'railroad',name:'Reading Railroad', price:200, mortgage:100 },
  { i:6,  type:'property',name:'Oriental Avenue', group:'lightblue', price:100, rent:[6,30,90,270,400,550], houseCost:50, mortgage:50 },
  { i:7,  type:'chance',  name:'Шанс' },
  { i:8,  type:'property',name:'Vermont Avenue', group:'lightblue', price:100, rent:[6,30,90,270,400,550], houseCost:50, mortgage:50 },
  { i:9,  type:'property',name:'Connecticut Avenue', group:'lightblue', price:120, rent:[8,40,100,300,450,600], houseCost:50, mortgage:60 },
  { i:10, type:'jail',    name:'Тюрьма / В гостях' },
  { i:11, type:'property',name:'St. Charles Place', group:'pink', price:140, rent:[10,50,150,450,625,750], houseCost:100, mortgage:70 },
  { i:12, type:'utility', name:'Electric Company', price:150, mortgage:75 },
  { i:13, type:'property',name:'States Avenue', group:'pink', price:140, rent:[10,50,150,450,625,750], houseCost:100, mortgage:70 },
  { i:14, type:'property',name:'Virginia Avenue', group:'pink', price:160, rent:[12,60,180,500,700,900], houseCost:100, mortgage:80 },
  { i:15, type:'railroad',name:'Pennsylvania Railroad', price:200, mortgage:100 },
  { i:16, type:'property',name:'St. James Place', group:'orange', price:180, rent:[14,70,200,550,750,950], houseCost:100, mortgage:90 },
  { i:17, type:'chest',   name:'Общественная казна' },
  { i:18, type:'property',name:'Tennessee Avenue', group:'orange', price:180, rent:[14,70,200,550,750,950], houseCost:100, mortgage:90 },
  { i:19, type:'property',name:'New York Avenue', group:'orange', price:200, rent:[16,80,220,600,800,1000], houseCost:100, mortgage:100 },
  { i:20, type:'parking', name:'Бесплатная стоянка' },
  { i:21, type:'property',name:'Kentucky Avenue', group:'red', price:220, rent:[18,90,250,700,875,1050], houseCost:150, mortgage:110 },
  { i:22, type:'chance',  name:'Шанс' },
  { i:23, type:'property',name:'Indiana Avenue', group:'red', price:220, rent:[18,90,250,700,875,1050], houseCost:150, mortgage:110 },
  { i:24, type:'property',name:'Illinois Avenue', group:'red', price:240, rent:[20,100,300,750,925,1100], houseCost:150, mortgage:120 },
  { i:25, type:'railroad',name:'B&O Railroad', price:200, mortgage:100 },
  { i:26, type:'property',name:'Atlantic Avenue', group:'yellow', price:260, rent:[22,110,330,800,975,1150], houseCost:150, mortgage:130 },
  { i:27, type:'property',name:'Ventnor Avenue', group:'yellow', price:260, rent:[22,110,330,800,975,1150], houseCost:150, mortgage:130 },
  { i:28, type:'utility', name:'Water Works', price:150, mortgage:75 },
  { i:29, type:'property',name:'Marvin Gardens', group:'yellow', price:280, rent:[24,120,360,850,1025,1200], houseCost:150, mortgage:140 },
  { i:30, type:'gotojail',name:'Отправляйтесь в тюрьму' },
  { i:31, type:'property',name:'Pacific Avenue', group:'green', price:300, rent:[26,130,390,900,1100,1275], houseCost:200, mortgage:150 },
  { i:32, type:'property',name:'North Carolina Avenue', group:'green', price:300, rent:[26,130,390,900,1100,1275], houseCost:200, mortgage:150 },
  { i:33, type:'chest',   name:'Общественная казна' },
  { i:34, type:'property',name:'Pennsylvania Avenue', group:'green', price:320, rent:[28,150,450,1000,1200,1400], houseCost:200, mortgage:160 },
  { i:35, type:'railroad',name:'Short Line', price:200, mortgage:100 },
  { i:36, type:'chance',  name:'Шанс' },
  { i:37, type:'property',name:'Park Place', group:'blue', price:350, rent:[35,175,500,1100,1300,1500], houseCost:200, mortgage:175 },
  { i:38, type:'tax',     name:'Налог на роскошь', amount:100 },
  { i:39, type:'property',name:'Boardwalk', group:'blue', price:400, rent:[50,200,600,1400,1700,2000], houseCost:200, mortgage:200 }
];

const GROUP_SIZE = { brown:2, lightblue:3, pink:3, orange:3, red:3, yellow:3, green:3, blue:2 };

const CHANCE_CARDS = [
  { text:'Пройдите на СТАРТ. Получите ₽200.', action:{type:'move', to:0} },
  { text:'Вас оштрафовали на ₽15.', action:{type:'pay', amount:15} },
  { text:'Банк выплачивает вам дивиденды ₽50.', action:{type:'collect', amount:50} },
  { text:'Отправляйтесь в тюрьму. Не проходите СТАРТ.', action:{type:'gotojail'} },
  { text:'Идите на Boardwalk.', action:{type:'move', to:39} },
  { text:'Идите на Illinois Avenue.', action:{type:'move', to:24} },
  { text:'Вы избраны председателем правления. Заплатите каждому игроку ₽50.', action:{type:'pay_each', amount:50} },
  { text:'Постройте здание — получите ₽45 за ремонт улиц.', action:{type:'collect', amount:45} },
  { text:'Карта «Освобождение из тюрьмы». Храните её.', action:{type:'jailcard'} },
  { text:'Ваши займы дают дивиденды. Получите ₽150.', action:{type:'collect', amount:150} },
  { text:'Идите назад на 3 клетки.', action:{type:'moverel', by:-3} },
  { text:'Идите на ближайшую железную дорогу.', action:{type:'nearest', kind:'railroad'} },
  { text:'Заплатите штраф ₽100 или вытяните карту Шанс.', action:{type:'pay', amount:100} },
  { text:'Вы выиграли конкурс красоты. Получите ₽10.', action:{type:'collect', amount:10} },
  { text:'Идите на Reading Railroad.', action:{type:'move', to:5} },
  { text:'Ремонт: заплатите ₽25 за дом и ₽100 за отель.', action:{type:'repairs', house:25, hotel:100} }
];

const CHEST_CARDS = [
  { text:'Ошибка банка в вашу пользу. Получите ₽200.', action:{type:'collect', amount:200} },
  { text:'Оплата врача. Заплатите ₽50.', action:{type:'pay', amount:50} },
  { text:'Возврат подоходного налога. Получите ₽20.', action:{type:'collect', amount:20} },
  { text:'День рождения! Каждый игрок платит вам ₽10.', action:{type:'collect_each', amount:10} },
  { text:'Продажа акций. Получите ₽50.', action:{type:'collect', amount:50} },
  { text:'Оплатите обучение в школе ₽50.', action:{type:'pay', amount:50} },
  { text:'Получите наследство ₽100.', action:{type:'collect', amount:100} },
  { text:'Заплатите за больницу ₽100.', action:{type:'pay', amount:100} },
  { text:'Карта «Освобождение из тюрьмы». Храните её.', action:{type:'jailcard'} },
  { text:'Отправляйтесь в тюрьму.', action:{type:'gotojail'} },
  { text:'Вам вернули налоговую переплату. Получите ₽20.', action:{type:'collect', amount:20} },
  { text:'Пройдите на СТАРТ. Получите ₽200.', action:{type:'move', to:0} },
  { text:'За ремонт улиц заплатите ₽40 за дом и ₽115 за отель.', action:{type:'repairs', house:40, hotel:115} },
  { text:'Вы получили приз за конкурс кроссвордов ₽100.', action:{type:'collect', amount:100} },
  { text:'Заплатите страховой взнос ₽50.', action:{type:'pay', amount:50} },
  { text:'Получите с каждого игрока по ₽10 за проданные акции.', action:{type:'collect_each', amount:10} }
];

const TOKEN_ICONS = ['🚗','🐕','🎩','🚢','🐈','👞','🧵','🛞'];
const PLAYER_COLORS = ['#8b5cf6','#3b82f6','#22c55e','#eab308','#ef4444','#ec4899','#14b8a6','#f97316'];
