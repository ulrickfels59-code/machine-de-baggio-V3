export const festiveModes=['auto','standard','halloween','year_end'] as const;
export type FestiveMode=typeof festiveModes[number];
export type FestiveTheme='standard'|'halloween'|'year_end';
export function festiveTheme(mode:FestiveMode,now=new Date()):FestiveTheme{
 if(mode!=='auto')return mode;
 const month=Number(new Intl.DateTimeFormat('en',{timeZone:'Europe/Paris',month:'numeric'}).format(now));
 return month===10?'halloween':month===12?'year_end':'standard';
}
