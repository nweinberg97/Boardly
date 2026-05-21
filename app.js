const board = document.getElementById('board');
const tabsContainer = document.getElementById('tabs');

// Pre-load the audio asset immediately at boot to prevent browser autoplay lag
const trashSound = new Audio('sounds/plastic-crunch-83779.mp3');

// Balanced 10-Colorway: 4 Blues, 4 Greens, and 2 Premium Dark Tones
const pastelColors = [
  '#E3F2FD', // 1. Ultra Light Ice Blue
  '#D0E1FD', // 2. Soft Powder Blue
  '#A9C7EB', // 3. Slate Blue Muted
  '#8FB3DE', // 4. Steel Blue Highlight
  '#F1F8E9', // 5. Minimalist Pale Mint
  '#E2EFE0', // 6. Soft Sage Green
  '#C2DBC1', // 7. Muted Olive/Clay Green
  '#99BFA7', // 8. Earthy Moss Green
  '#2C3E50', // 9. Deep Navy Charcoal
  '#1E252B'  // 10. Premium Architectural Off-Black
];

/* ---------- ISOLATED COLOR STORAGE (100% SAFE FROM CORE STATE) ---------- */

// Load colors from an entirely independent storage key so it cannot trigger a core state wipeout
let savedColors;
try {
  savedColors = JSON.parse(localStorage.getItem('boardly-tab-palette'));
} catch (e) {
  console.error("Color parsing error, resetting palette state:", e);
  savedColors = null;
}

// Convert back to a live Map for runtime execution, or start fresh if empty
const activeTabColors = new Map(savedColors ? Object.entries(savedColors) : null);

function saveColorsToStorage() {
  // Convert our runtime Map into a flat object structure for safe JSON stringification
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

/* ---------- SAVE ---------- */

function saveState() {
  localStorage.setItem('boardly-data', JSON.stringify(state));
}

/* ---------- BOARDS ---------- */

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

function renderBoard() {
  board.innerHTML = '';

  getCurrentBoardData().forEach(card => {
    createCardElement(card);
  });
}

/* ---------- CARDS ---------- */

function createCard(type) {
  const card = {
    id: Date.now(),
    type,
    x: 100,
    y: 100,
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

    state.boards[state.currentBoard] =
      getCurrentBoardData().filter(c => c.id !== cardData.id);

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
      // Temporarily bypass the card to see what element is truly underneath it
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
    // Unbind global event listeners immediately when execution finishes
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
        // Filter card out of current board array
        state.boards[state.currentBoard] = getCurrentBoardData().filter(c => c.id !== cardData.id);

        // Reset the audio tracking to the beginning and play the preloaded asset
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

    // Only hook up calculations when a mouse press is active
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

  // Configured as a symmetric 5-column, 2-row grid for the 10 options
  Object.assign(menu.style, {
    position: 'absolute',
    left: `${event.pageX}px`,
    top: `${event.pageY}px`,
    zIndex: '10000',
    background: '#ffffff',
    border: '1px solid #ccc',
    borderRadius: '8px',
    padding: '8px',
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 30px)',
    gap: '6px',
    boxShadow: '0px 4px 10px rgba(0,0,0,0.15)'
  });

  pastelColors.forEach(color => {
    const swatch = document.createElement('div');
    swatch.className = 'color-swatch';
    
    Object.assign(swatch.style, {
      width: '30px',
      height: '30px',
      borderRadius: '4px',
      backgroundColor: color,
      cursor: 'pointer',
      border: '1px solid rgba(0,0,0,0.1)'
    });

    swatch.addEventListener('click', (e) => {
      e.stopPropagation();
      
      // Store in memory allocation map
      activeTabColors.set(tab, color);

      // Commit color state to isolated localStorage key
      saveColorsToStorage();

      renderTabs();
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

  state.tabs.forEach((tab) => {
    const button = document.createElement('button');

    button.classList.add('tab');

    if (tab === state.currentBoard) {
      button.classList.add('active');
    }

    button.textContent = tab;
    button.setAttribute('draggable', 'true');

    // Safe color read directly out of our persistent browser color configuration map
    if (activeTabColors.has(tab)) {
      button.style.backgroundColor = activeTabColors.get(tab);
    }

    /* SWITCH TAB */
    button.addEventListener('click', () => {
      state.currentBoard = tab;
      saveState();
      renderTabs();
      renderBoard();
    });

    /* RIGHT CLICK → TARGET DESIGNATED PICKER POPUP */
    button.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showColorMenu(e, tab);
    });

    /* RENAME TAB */
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

      state.tabs = state.tabs.map(t =>
        t === tab ? formatted : t
      );

      state.boards[formatted] = state.boards[tab] || [];
      delete state.boards[tab];

      // Update the color map key configuration cleanly if a tab is renamed, then save changes
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

    /* DRAG START */
    button.addEventListener('dragstart', (e) => {
      button.classList.add('dragging');
      e.dataTransfer.setData('text/plain', tab);
    });

    button.addEventListener('dragend', () => {
      button.classList.remove('dragging');
    });

    /* DROP OVER */
    button.addEventListener('dragover', (e) => {
      e.preventDefault();
      button.classList.add('drag-over');
    });

    button.addEventListener('dragleave', () => {
      button.classList.remove('drag-over');
    });

    /* DROP REORDER */
    button.addEventListener('drop', (e) => {
      e.preventDefault();

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
      
      // Remove color entry cleanly on tab deletion, then commit changes to storage
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

/* ---------- INIT ---------- */

function initializeBoardly() {
  renderTabs();
  renderBoard();
  enableTrashBin();
}

initializeBoardly();
