// Performer-controlled force data (used in order of opened contacts)
const FORCED_CONTACT_DATA = [
  { phone: '(212) 555-0146', email: 'northstar@icloud.com', birthday: 'March 14' },
  { phone: '(917) 555-0192', email: 'velvetroom@me.com', birthday: 'August 22' },
  { phone: '(646) 555-0118', email: 'midnightlane@gmail.com', birthday: 'December 5' }
];

const CONTACT_NAMES = [
  'Aaron Adams', 'Abigail Allen', 'Aiden Archer', 'Alicia Avery',
  'Bella Brooks', 'Ben Bennett', 'Bianca Byrd', 'Brandon Blake',
  'Caleb Cole', 'Caroline Cruz', 'Carter Cain', 'Chloe Clarke',
  'Daniel Diaz', 'Daphne Dunn', 'David Doyle', 'Dylan Drake',
  'Eleanor Evans', 'Eli Ellis', 'Emma Everett', 'Ethan Easton',
  'Felix Flores', 'Fiona Ford', 'Franklin Fry', 'Freya Finch',
  'Gabriel Gray', 'Grace Green', 'Gwen Gallagher', 'Gavin Gale',
  'Hannah Hayes', 'Harper Hill', 'Henry Holt', 'Hudson Hart',
  'Ian Irwin', 'Iris Ingram', 'Isaac Iverson', 'Ivy Innes',
  'Jack Jensen', 'Jade Jordan', 'James Jarvis', 'Julia Jensen',
  'Kai Keller', 'Kara Knight', 'Keegan Knox', 'Kyra Kent',
  'Landon Lane', 'Laura Lewis', 'Leo Logan', 'Lila Lambert',
  'Mason Moore', 'Maya Miller', 'Mila Monroe', 'Miles Mercer',
  'Nadia Nelson', 'Nathan Nash', 'Nina Novak', 'Noah Neal',
  'Olivia Owen', 'Oscar Ortiz', 'Owen Oliver', 'Opal Ochoa',
  'Parker Pierce', 'Paula Page', 'Peyton Price', 'Phoebe Park',
  'Quentin Quinn', 'Queenie Quade',
  'Riley Ross', 'Ruby Rivers', 'Ryan Rhodes', 'Ruth Reed',
  'Sage Sutton', 'Samuel Shaw', 'Scarlett Stone', 'Sebastian Sloan',
  'Taylor Tate', 'Theo Turner', 'Tristan Todd', 'Tessa Travis',
  'Uma Underwood', 'Uriel Urban',
  'Valerie Vaughn', 'Victor Vega', 'Violet Vance',
  'Wesley White', 'Willow West', 'Wyatt Walsh',
  'Xander Xu', 'Xenia Xavier',
  'Yara Young', 'Yosef York',
  'Zane Zimmerman', 'Zoe Zeller'
].sort((a, b) => a.localeCompare(b));

const listView = document.getElementById('listView');
const alphaIndex = document.getElementById('alphaIndex');
const searchInput = document.getElementById('searchInput');
const detailView = document.getElementById('detailView');
const detailName = document.getElementById('detailName');
const detailPhone = document.getElementById('detailPhone');
const detailEmail = document.getElementById('detailEmail');
const detailBirthday = document.getElementById('detailBirthday');
const detailCard = document.getElementById('detailCard');
const loadingCard = document.getElementById('loadingCard');
const backBtn = document.getElementById('backBtn');

const sessionState = {
  openedCount: 0
};

function buildGroupedContacts(query = '') {
  const normalized = query.trim().toLowerCase();
  const filtered = normalized
    ? CONTACT_NAMES.filter((name) => name.toLowerCase().includes(normalized))
    : CONTACT_NAMES;

  const groups = new Map();
  filtered.forEach((name) => {
    const letter = name[0].toUpperCase();
    if (!groups.has(letter)) groups.set(letter, []);
    groups.get(letter).push(name);
  });

  return groups;
}

function renderList(query = '') {
  const groups = buildGroupedContacts(query);
  listView.innerHTML = '';
  alphaIndex.innerHTML = '';

  if (groups.size === 0) {
    const empty = document.createElement('p');
    empty.textContent = 'No Contacts';
    empty.style.padding = '20px 16px';
    empty.style.color = '#6e6e73';
    listView.appendChild(empty);
    return;
  }

  groups.forEach((names, letter) => {
    const section = document.createElement('section');
    section.id = `section-${letter}`;

    const header = document.createElement('h3');
    header.className = 'section-header';
    header.textContent = letter;
    section.appendChild(header);

    names.forEach((name) => {
      const btn = document.createElement('button');
      btn.className = 'contact-row';
      btn.textContent = name;
      btn.type = 'button';
      btn.addEventListener('click', () => openContact(name));
      section.appendChild(btn);
    });

    listView.appendChild(section);

    if (!query.trim()) {
      const indexBtn = document.createElement('button');
      indexBtn.type = 'button';
      indexBtn.textContent = letter;
      indexBtn.addEventListener('click', () => {
        document.getElementById(`section-${letter}`)?.scrollIntoView({ block: 'start' });
      });
      alphaIndex.appendChild(indexBtn);
    }
  });
}

function getForcedDataForOpenCount(openedCount) {
  const forceIndex = Math.min(openedCount - 1, FORCED_CONTACT_DATA.length - 1);
  return FORCED_CONTACT_DATA[forceIndex];
}

function openContact(name) {
  sessionState.openedCount += 1;
  const forced = getForcedDataForOpenCount(sessionState.openedCount);

  detailName.textContent = name;
  detailCard.classList.add('hidden');
  loadingCard.classList.remove('hidden');
  detailView.classList.remove('hidden');

  setTimeout(() => {
    detailPhone.textContent = forced.phone;
    detailEmail.textContent = forced.email;
    detailBirthday.textContent = forced.birthday;

    loadingCard.classList.add('hidden');
    detailCard.classList.remove('hidden');
  }, 700);
}

backBtn.addEventListener('click', () => {
  detailView.classList.add('hidden');
  detailCard.classList.add('hidden');
  loadingCard.classList.add('hidden');
});

searchInput.addEventListener('input', (e) => {
  renderList(e.target.value);
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}

renderList();
