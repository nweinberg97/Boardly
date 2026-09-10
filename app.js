const board = document.getElementById('board');
const tabsContainer = document.getElementById('tabs');
const tabsWrapper = document.getElementById('tabs-wrapper');
const undoBtn = document.getElementById('undo-btn');

const trashSound = new Audio('sounds/sounds_plastic-crunch-83779.mp3');
trashSound.preload = 'auto';

// 10-Color Airbnb-Inspired Low-Saturation Palette
const boardColors = [
  '#475569', // 1: Muted Charcoal
  '#658a77', // 2: Dusty Sage
  '#b47558', // 3: Soft Terracotta
  '#5a73a2', // 4: Muted Indigo
  '#c29b38', // 5: Soft Ochre
  '#b86b85', // 6: Dusty Rose
  '#528892', // 7: Soft Teal
  '#8b7bb4', // 8: Muted Lavender
  '#b89b72', // 9: Warm Sand
  '#64748b'  // 10: Slate Gray
];

function getDefaultColor(index) {
  return boardColors[index % boardColors.length];
}

/* ---------- UNDO HISTORY STACK ---------- */

let undoStack = [];

function pushUndoAction(action) {
  undoStack.push(action);
  updateUndoButtonVisual();
}

function updateUndoButtonVisual() {
  if (undoBtn) {
    undoBtn.style.opacity = undoStack.length > 0 ? '1' : '0.35';
    undoBtn.title = undoStack.length > 0 ? "Undo last deletion" : "Nothing to undo";
  }
}

undoBtn.addEventListener('click', () => {
  if (undoStack.length === 0) return;
  const action = undoStack.pop();

  if (action.type === 'card') {
    ensureBoardExists(action.boardName);
    state.boards[action.boardName].splice(action.index, 0, action.cardData);
  } else if (action.type === 'tab') {
    if (!state.tabs.includes(action.tabName)) {
      state.tabs.splice(action.tabIndex, 0, action.tabName);
      state.boards[action.tabName] = action.boardData || [];
      if (action.color) {
        activeTabColors.set(action.tabName, action.color);
        saveColorsToStorage();
      }
    }
  }

  saveState();
  renderTabs();
  renderBoard();
  updateUndoButtonVisual();
});

/* ---------- GLOBAL UNDO KEYBOARD SHORTCUT ---------- */

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;

    const currentUndoBtn = document.getElementById('undo-btn');
    if (undoStack.length > 0 && currentUndoBtn) {
      e.preventDefault();
      currentUndoBtn.click();
    }
  }
});
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

// Lock permanent colors to the default tab names on first load
state.tabs.forEach((tab, index) => {
  if (!activeTabColors.has(tab)) {
    activeTabColors.set(tab, getDefaultColor(index));
  }
});
saveColorsToStorage();

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

/* ---------- BOARD INDICATION TRACKING ---------- */

function updateCanvasBackground() {
  const currentTab = state.currentBoard;
  const tabIndex = state.tabs.indexOf(currentTab);
  const color = activeTabColors.has(currentTab) 
    ? activeTabColors.get(currentTab) 
    : getDefaultColor(tabIndex >= 0 ? tabIndex : 0);

  board.style.setProperty('--active-board-accent', color);
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

function deleteCard(cardId) {
  const boardData = getCurrentBoardData();
  const index = boardData.findIndex(c => c.id === cardId);
  if (index === -1) return;

  const cardData = boardData[index];
  pushUndoAction({
    type: 'card',
    boardName: state.currentBoard,
    cardData: { ...cardData },
    index
  });

  state.boards[state.currentBoard] = boardData.filter(c => c.id !== cardId);
  saveState();
  renderBoard();
}

function createCardElement(cardData) {
  const card = document.createElement('div');
  card.classList.add('card', cardData.type);
  card.style.left = `${cardData.x}px`;
  card.style.top = `${cardData.y}px`;

  // Hover delete button (×)
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'card-delete';
  deleteBtn.innerHTML = '×';
  deleteBtn.title = 'Delete card';
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    deleteCard(cardData.id);
  });
  card.appendChild(deleteBtn);

  const textarea = document.createElement('textarea');
  textarea.value = cardData.text;
  textarea.placeholder = "Write something...";

  textarea.addEventListener('input', () => {
    cardData.text = textarea.value;
    saveState();
  });

  card.appendChild(textarea);
  enableDragging(card, cardData);

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
        deleteCard(cardData.id);
        trashSound.currentTime = 0;
        trashSound.play().catch(err => console.log("Audio playback prevented:", err));
        return; 
      }
    }
    saveState();
  };

  element.addEventListener('mousedown', (e) => {
    if (e.target.tagName === 'TEXTAREA' || e.target.classList.contains('card-delete')) return;

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

  mutedColors.forEach(color => {
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

function deleteTab(tabName) {
  const tabIndex = state.tabs.indexOf(tabName);
  if (tabIndex === -1) return;

  pushUndoAction({
    type: 'tab',
    tabName,
    tabIndex,
    boardData: state.boards[tabName],
    color: activeTabColors.get(tabName)
  });

  state.tabs = state.tabs.filter(t => t !== tabName);
  delete state.boards[tabName];
  activeTabColors.delete(tabName);
  saveColorsToStorage();

  if (state.currentBoard === tabName) {
    state.currentBoard = state.tabs[0] || '';
  }

  saveState();
  renderTabs();
  renderBoard();
}

function renderTabs() {
  tabsContainer.innerHTML = '';

  state.tabs.forEach((tab, index) => {
    const button = document.createElement('button');
    button.classList.add('tab');
    button.title = tab;

    if (tab === state.currentBoard) {
      button.classList.add('active');
    }

    button.setAttribute('draggable', 'true');

    const tabColor = activeTabColors.has(tab) ? activeTabColors.get(tab) : getDefaultColor(index);
    
    // Tab inner structure with color dot, label text, and hover delete (×) button
    button.innerHTML = `
      <span class="tab-dot" style="background-color: ${tabColor};"></span>
      <span class="tab-text">${tab}</span>
      <button class="tab-delete" title="Delete tab">×</button>
    `;

    button.querySelector('.tab-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteTab(tab);
    });

  let clickTimeout = null;

button.addEventListener('click', (e) => {
  if (clickTimeout) {
    clearTimeout(clickTimeout);
    clickTimeout = null;
    return;
  }

  clickTimeout = setTimeout(() => {
    clickTimeout = null;
    state.currentBoard = tab;
    saveState();
    renderTabs();
    renderBoard();
  }, 250);
});

button.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  showColorMenu(e, tab);
});

button.addEventListener('dblclick', (e) => {
  e.stopPropagation();
  if (clickTimeout) {
    clearTimeout(clickTimeout);
    clickTimeout = null;
  }

  const textSpan = button.querySelector('.tab-text');
  if (!textSpan) return;

  const currentText = tab;
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'tab-input';
  input.value = currentText;

  textSpan.replaceWith(input);
  input.focus();
  input.select();

  let isSubmitted = false;

  const commitChange = () => {
    if (isSubmitted) return;
    isSubmitted = true;

    const newName = input.value.toLowerCase().trim();
    if (!newName || newName === currentText) {
      renderTabs();
      return;
    }

    if (state.tabs.includes(newName)) {
      alert('Tab already exists');
      renderTabs();
      return;
    }

    state.tabs = state.tabs.map(t => t === currentText ? newName : t);
    state.boards[newName] = state.boards[currentText] || [];
    delete state.boards[currentText];

    if (activeTabColors.has(currentText)) {
      activeTabColors.set(newName, activeTabColors.get(currentText));
      activeTabColors.delete(currentText);
      saveColorsToStorage();
    }

    if (state.currentBoard === currentText) {
      state.currentBoard = newName;
    }

    saveState();
    renderTabs();
    renderBoard();
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitChange();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      isSubmitted = true;
      renderTabs();
    }
  });

  input.addEventListener('blur', () => {
    commitChange();
  });
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

/* ---------- TOOLBAR SCROLL NAVIGATION BUTTONS (CORRECTED CONVEYOR BELT) ---------- */

const scrollLeftBtn = document.getElementById('scroll-left');
const scrollRightBtn = document.getElementById('scroll-right');

if (scrollLeftBtn && scrollRightBtn && tabsContainer) {
  scrollRightBtn.addEventListener('click', () => {
    if (state.tabs.length <= 1) return;

    // Clicking RIGHT should move the conveyor belt to the right:
    // Take the first item and move it to the back.
    const shiftedTab = state.tabs.shift();
    state.tabs.push(shiftedTab);

    saveState();
    renderTabs();
    renderBoard();
  });

  scrollLeftBtn.addEventListener('click', () => {
    if (state.tabs.length <= 1) return;

    // Clicking LEFT should move the conveyor belt to the left:
    // Take the last item and move it to the front.
    const poppedTab = state.tabs.pop();
    state.tabs.unshift(poppedTab);

    saveState();
    renderTabs();
    renderBoard();
  });
}

/* ---------- ADD TAB ---------- */

document.getElementById('add-tab').addEventListener('click', () => {
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
  
  // Assign a permanent color locked to the new tab's name
  activeTabColors.set(formatted, getDefaultColor(state.tabs.length - 1));
  saveColorsToStorage();

  saveState();
  renderTabs();
});

/* ---------- BUTTONS ---------- */

document.getElementById('add-goal').addEventListener('click', () => createCard('goal'));
document.getElementById('add-task').addEventListener('click', () => createCard('task'));
document.getElementById('add-note').addEventListener('click', () => createCard('note'));

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
      deleteTab(draggedTab);
      // Replaced global trashSound with a fresh instance to avoid browser blockages
      new Audio('sounds/sounds_plastic-crunch-83779.mp3').play().catch(err => console.log("Audio playback prevented:", err));
    }
  });
}

function initializeBoardly() {
  renderTabs();
  renderBoard();
  enableTrashBin();
  updateUndoButtonVisual();
}

initializeBoardly();
