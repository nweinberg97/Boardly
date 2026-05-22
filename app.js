const board = document.getElementById('board');
const tabsContainer = document.getElementById('tabs');

const trashSound = new Audio('sounds/plastic-crunch-83779.mp3');

// Vibrant Broad-Spectrum Palette: Clean, deep, highly saturated tones across the color wheel
const vibrantColors = [
  '#ef4444', // 1. Vibrant Red
  '#3b82f6', // 2. Electric Blue
  '#10b981', // 3. Emerald Green
  '#f59e0b', // 4. Amber Yellow
  '#8b5cf6', // 5. Vivid Purple
  '#ec4899', // 6. Hot Pink
  '#06b6d4', // 7. Cyan / Teal
  '#f97316', // 8. Pure Orange
  '#64748b', // 9. Slate Gray
  '#1e252b'  // 10. Architectural Charcoal
];

function getDefaultColor(tabIndex) {
  return vibrantColors[tabIndex % vibrantColors.length];
}

/* ---------- ISOLATED COLOR STORAGE ---------- */

let savedColors;
try {
  savedColors = JSON.parse(localStorage.getItem('boardly-tab-palette'));
} catch (e) {
  console.error("Color parsing error, resetting palette state:", e);
  savedColors = null;
}

const activeTabColors = new Map(savedColors ? Object.entries(savedColors) : null);

function saveColorsToStorage() {
  const colorObject = Object.fromEntries(activeTabColors);
  localStorage.setItem('boardly-tab-palette', JSON.stringify(colorObject));
}

/* ---------- STATE ---------- */

const state = JSON.parse(localStorage.getItem('boardly-data')) || {
  currentBoard: 'health',

  tabs: [
    'health',
    'admin',
    'chores',
    'learning',
    'personal',
    'relationships',
    'passions'
  ],

  boards: {}
};

function saveState() {
  localStorage.setItem('boardly-data', JSON.stringify(state));
}

function ensureBoardExists(tab) {
  if (!state.boards[tab]) {
    state.boards[tab] = [];
  }
}

function getCurrentBoardData() {
  ensureBoardExists(state.currentBoard);
  return state.boards[state.currentBoard];
}

/* ---------- BOARD ---------- */

function updateCanvasBackground() {
  const currentTab = state.currentBoard;
  const tabIndex = state.tabs.indexOf(currentTab);
  const color = activeTabColors.has(currentTab) 
    ? activeTabColors.get(currentTab) 
    : getDefaultColor(tabIndex >= 0 ? tabIndex : 0);

  // Apply a subtle 8% transparency wash to match the new high vibrancy colors cleanly
  board.style.backgroundColor = `${color}13`; 
}

function renderBoard() {
  board.innerHTML = '';
  updateCanvasBackground();

  getCurrentBoardData().forEach(card => {
    createCardElement(card);
  });
}

/* ---------- CARDS ---------- */

function createCard(type) {
  const spawnLeft = (window.innerWidth / 2) - 120;
  const spawnTop = window.innerHeight - 160 - 110;

  const card = {
    id: Date.now(),
    type,
    x: spawnLeft,
    y: spawnTop,
    text: ''
  };

  getCurrentBoardData().push(card);

  saveState();
  renderBoard();
}

function createCardElement(cardData) {
  const card = document.createElement('div');
  card.classList.add('card', cardData.type);
  card.style.left = `${cardData.x}px`;
  card.style.top = `${cardData.y}px`;

  // Appends top header dot layout track to the card frame dynamically
  const cardHeader = document.createElement('div');
  cardHeader.className = 'card-header';
  const cardDot = document.createElement('span');
  cardDot.className = 'card-dot';
  cardHeader.appendChild(cardDot);
  card.appendChild(cardHeader);

  const textarea = document.createElement('textarea');
  textarea.value = cardData.text;

  textarea.addEventListener('input', () => {
    cardData.text = textarea.value;
    saveState();
  });

  card.appendChild(textarea);
  enableDragging(card, cardData);

  card.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    state.boards[state.currentBoard] = getCurrentBoardData().filter(c => c.id !== cardData.id);
    saveState();
    renderBoard();
  });

  board.appendChild(card);
}

/* ---------- DRAG CARDS ---------- */

function enableDragging(element, cardData) {
  let offsetX = 0;
  let offsetY = 0;

  const onMouseMove = (e) => {
    const x = e.clientX - offsetX;
    const y = e.clientY - offsetY;

    element.style.left = `${x}px`;
    element.style.top = `${y}px`;

    cardData.x = x;
    cardData.y = y;

    const trashBin = document.querySelector('.trash-bin');
    if (trashBin) {
      element.style.pointerEvents = 'none';
      const elementUnderMouse = document.elementFromPoint(e.clientX, e.clientY);
      element.style.pointerEvents = 'auto'; 

      if (elementUnderMouse && elementUnderMouse.closest('.trash-bin')) {
        trashBin.classList.add('drag-over');
      } else {
        trashBin.classList.remove('drag-over');
      }
    }
  };

  const onMouseUp = (e) => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);

    element.style.zIndex = 1;
    element.classList.remove('dragging-card');

    const trashBin = document.querySelector('.trash-bin');
    if (trashBin) {
      trashBin.classList.remove('drag-over');

      element.style.pointerEvents = 'none';
      const elementUnderMouse = document.elementFromPoint(e.clientX, e.clientY);
      element.style.pointerEvents = 'auto';

      if (elementUnderMouse && elementUnderMouse.closest('.trash-bin')) {
        state.boards[state.currentBoard] = getCurrentBoardData().filter(c => c.id !== cardData.id);
        trashSound.currentTime = 0;
        trashSound.play().catch(err => console.log("Audio playback prevented:", err));

        saveState();
        renderBoard();
        return; 
      }
    }
    saveState();
  };

  element.addEventListener('mousedown', (e) => {
    if (e.target.tagName === 'TEXTAREA') return;

    offsetX = e.clientX - element.offsetLeft;
    offsetY = e.clientY - element.offsetTop;

    element.style.zIndex = 1000;
    element.classList.add('dragging-card');

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });
}

/* ---------- POPUP COLOR PICKER ---------- */

function showColorMenu(event, tab) {
  const existing = document.querySelector('.color-menu');
  if (existing) existing.remove();

  const menu = document.createElement('div');
  menu.className = 'color-menu';

  Object.assign(menu.style, {
    left: `${event.pageX}px`,
    top: `${event.pageY}px`
  });

  vibrantColors.forEach(color => {
    const swatch = document.createElement('div');
    swatch.className = 'color-swatch';
    swatch.style.backgroundColor = color;

    swatch.addEventListener('click', (e) => {
      e.stopPropagation();
      activeTabColors.set(tab, color);
      saveColorsToStorage();
      renderTabs();
      updateCanvasBackground();
      cleanupMenu();
    });

    menu.appendChild(swatch);
  });

  document.body.appendChild(menu);

  const closeOnOutsideClick = (e) => {
    if (!menu.contains(e.target)) {
      cleanupMenu();
    }
  };

  function cleanupMenu() {
    menu.remove();
    document.removeEventListener('mousedown', closeOnOutsideClick);
  }

  setTimeout(() => {
    document.addEventListener('mousedown', closeOnOutsideClick);
  }, 20);
}

/* ---------- TABS ---------- */

function renderTabs() {
  tabsContainer.innerHTML = '';

  state.tabs.forEach((tab, index) => {
    const button = document.createElement('button');
    button.classList.add('tab');

    if (tab === state.currentBoard) {
      button.classList.add('active');
    }

    button.setAttribute('draggable', 'true');

    const tabColor = activeTabColors.has(tab) ? activeTabColors.get(tab) : getDefaultColor(index);
    button.innerHTML = `<span class="tab-dot" style="background-color: ${tabColor};"></span>${tab}`;

    button.addEventListener('click', () => {
      state.currentBoard = tab;
      saveState();
      renderTabs();
      renderBoard();
    });

    button.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showColorMenu(e, tab);
    });

    button.addEventListener('dblclick', (e) => {
      e.stopPropagation();

      const newName = prompt('Rename tab:', tab);
      if (!newName) return;

      const formatted = newName.toLowerCase().trim();
      if (!formatted || formatted === tab) return;

      if (state.tabs.includes(formatted)) {
        alert('Tab already exists');
        return;
      }

      state.tabs = state.tabs.map(t => t === tab ? formatted : t);
      state.boards[formatted] = state.boards[tab] || [];
      delete state.boards[tab];

      if (activeTabColors.has(tab)) {
        activeTabColors.set(formatted, activeTabColors.get(tab));
        activeTabColors.delete(tab);
        saveColorsToStorage();
      }

      if (state.currentBoard === tab) {
        state.currentBoard = formatted;
      }

      saveState();
      renderTabs();
      renderBoard();
    });

    button.addEventListener('dragstart', (e) => {
      button.classList.add('dragging');
      e.dataTransfer.setData('text/plain', tab);
    });

    button.addEventListener('dragend', () => {
      button.classList.remove('dragging');
    });

    button.addEventListener('dragover', (e) => {
      e.preventDefault();
      button.classList.add('drag-over');
    });

    button.addEventListener('dragleave', () => {
      button.classList.remove('drag-over');
    });

    button.addEventListener('drop', (e) => {
      e.preventDefault();
      button.classList.remove('drag-over');

      const draggedTab = e.dataTransfer.getData('text/plain');

      if (!state.tabs.includes(draggedTab)) return;
      if (draggedTab === tab) return;

      const fromIndex = state.tabs.indexOf(draggedTab);
      const toIndex = state.tabs.indexOf(tab);

      state.tabs.splice(fromIndex, 1);
      state.tabs.splice(toIndex, 0, draggedTab);

      saveState();
      renderTabs();
    });

    tabsContainer.appendChild(button);
  });
}

/* ---------- ADD TAB ---------- */

document.getElementById('add-tab')
.addEventListener('click', () => {
  if (state.tabs.length >= 10) {
    alert('Maximum 10 tabs allowed');
    return;
  }

  const tabName = prompt('Enter tab name');
  if (!tabName) return;

  const formatted = tabName.toLowerCase().trim();

  if (state.tabs.includes(formatted)) {
    alert('Tab already exists');
    return;
  }

  state.tabs.push(formatted);
  state.boards[formatted] = [];

  saveState();
  renderTabs();
});

/* ---------- BUTTONS ---------- */

document.getElementById('add-goal')
.addEventListener('click', () => createCard('goal'));

document.getElementById('add-task')
.addEventListener('click', () => createCard('task'));

document.getElementById('add-note')
.addEventListener('click', () => createCard('note'));

/* ---------- TRASH BIN ---------- */

function enableTrashBin() {
  const trashBin = document.querySelector('.trash-bin');
  if (!trashBin) return;

  trashBin.addEventListener('dragover', (e) => {
    e.preventDefault();
    trashBin.classList.add('drag-over');
  });

  trashBin.addEventListener('dragleave', () => {
    trashBin.classList.remove('drag-over');
  });

  trashBin.addEventListener('drop', (e) => {
    e.preventDefault();
    trashBin.classList.remove('drag-over');

    const draggedTab = e.dataTransfer.getData('text/plain');

    if (draggedTab && state.tabs.includes(draggedTab)) {
      state.tabs = state.tabs.filter(t => t !== draggedTab);
      delete state.boards[draggedTab];
      
      activeTabColors.delete(draggedTab);
      saveColorsToStorage();

      if (state.currentBoard === draggedTab) {
        state.currentBoard = state.tabs[0] || '';
      }

      saveState();
      renderTabs();
      renderBoard();
    }
  });
}

function initializeBoardly() {
  renderTabs();
  renderBoard();
  enableTrashBin();
}

initializeBoardly();
