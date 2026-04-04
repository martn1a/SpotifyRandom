// Genre clusters — extracted from old-index.html
// Used to group Spotify genre strings into 8 broad categories

export const GENRE_CLUSTERS = [
  {
    id: 'electronic',
    label: 'Electronic',
    icon: '⚡',
    kw: ['electronic','techno','house','ambient','drum and bass','dnb','dubstep','trance','garage','jungle','breakbeat','idm','glitch','downtempo','synthwave','darkwave','edm','electronica','trip-hop','synth','rave','acid','chillout','dub','eurodance','electro','bass music','vaporwave','industrial','noise','minimal techno','tech house','deep house','progressive house','elektronisch','tanzmusik','elektronische musik'],
  },
  {
    id: 'rock',
    label: 'Rock',
    icon: '🎸',
    kw: ['rock','alternative','grunge','post-rock','shoegaze','progressive','art rock','garage rock','britpop','jangle','psych','kraut','space rock','math rock','stoner rock','desert rock','rockmusik','deutschrock','gitarrenmusik'],
  },
  {
    id: 'punk',
    label: 'Punk / Indie',
    icon: '📻',
    kw: ['punk','indie','hardcore','post-hardcore','noise rock','lo-fi','slacker','college rock','emo','screamo','post-punk','new wave','coldwave','indiemusik','punkrock'],
  },
  {
    id: 'metal',
    label: 'Metal',
    icon: '🤘',
    kw: ['metal','heavy metal','black metal','death metal','doom','thrash','sludge','speed metal','power metal','prog metal','deathcore','metalcore','symphonic metal','folk metal','schwermetall'],
  },
  {
    id: 'hiphop',
    label: 'Hip-Hop / R&B',
    icon: '🎤',
    kw: ['hip hop','hip-hop','rap','r&b','soul','neo-soul','funk','trap','grime','boom bap','urban','rhythm and blues','conscious','southern hip hop','east coast','west coast hip hop','drill','deutschrap','hiphop','rapmusik'],
  },
  {
    id: 'pop',
    label: 'Pop',
    icon: '✨',
    kw: ['pop','dream pop','chamber pop','baroque pop','electropop','hyperpop','bedroom pop','art pop','bubblegum','synth pop','j-pop','k-pop','dance pop','teen pop','sophisti-pop','popmusik','schlager','deutschpop'],
  },
  {
    id: 'jazz',
    label: 'Jazz / Blues',
    icon: '🎷',
    kw: ['jazz','blues','swing','bebop','free jazz','latin jazz','soul jazz','gospel','boogie','ragtime','cool jazz','fusion','nu jazz','jazzmusik','bluesmusik','jazzklassiker'],
  },
  {
    id: 'classical',
    label: 'Classical',
    icon: '🎻',
    kw: ['classical','contemporary classical','chamber','orchestral','opera','choral','minimalism','neo-classical','neoclassical','baroque','romantic','impressionist','avant-garde','new music','klassik','klassisch','kammermusik','klassisches klavier','konzert','sinfonie','sinfonisch','oper','chor','orchester','barock','romantik','zeitgenossisch','neue musik','klaviermusik','streichermusik','kammerjazz'],
  },
  {
    id: 'folk',
    label: 'Folk / World',
    icon: '🌍',
    kw: ['folk','country','americana','bluegrass','world','reggae','afrobeat','latin','bossa','celtic','singer-songwriter','acoustic','roots','tropicalia','cumbia','salsa','flamenco','afropop','dancehall','calypso','ska','roots reggae','dub reggae','volksmusik','weltmusik','folkmusik','liedermacher','akustik'],
  },
]

export function clusterOf(genre) {
  const gl = genre.toLowerCase()
  for (const cluster of GENRE_CLUSTERS) {
    if (cluster.kw.some(k => gl.includes(k))) return cluster.id
  }
  return 'other'
}
