const board = document.getElementById('board');
const tabsContainer = document.getElementById('tabs');

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
  let isDragging = false;

  element.addEventListener('mousedown', (e) => {

    if (e.target.tagName === 'TEXTAREA') return;

    isDragging = true;

    offsetX = e.clientX - element.offsetLeft;
    offsetY = e.clientY - element.offsetTop;

    element.style.zIndex = 1000;
  });

  document.addEventListener('mousemove', (e) => {

    if (!isDragging) return;

    const x = e.clientX - offsetX;
    const y = e.clientY - offsetY;

    element.style.left = `${x}px`;
    element.style.top = `${y}px`;

    cardData.x = x;
    cardData.y = y;
  });

  document.addEventListener('mouseup', () => {

    if (isDragging) saveState();

    isDragging = false;
    element.style.zIndex = 1;
  });
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

    /* SWITCH TAB */
    button.addEventListener('click', () => {
      state.currentBoard = tab;
      saveState();
      renderTabs();
      renderBoard();
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

/* ---------- INIT ---------- */

function initializeBoardly() {
  renderTabs();
  renderBoard();
  enableTrashBin();
}

initializeBoardly();


function enableTrashBin() {
  const trashBin = document.querySelector('.trash-bin');
  const sound = new Audio('sounds/plastic-crunch-83779.mp3');

  trashBin.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  trashBin.addEventListener('drop', (e) => {
    e.preventDefault();

    const cardId = Number(e.dataTransfer.getData('text/plain'));

    state.boards[state.currentBoard] =
      getCurrentBoardData().filter(card => card.id !== cardId);

    sound.currentTime = 0;
    sound.play();

    saveState();
    renderBoard();
  });
}


