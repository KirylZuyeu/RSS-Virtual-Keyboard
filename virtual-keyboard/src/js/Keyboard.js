import * as storage from './storage';
import create from './utils/create';
import language from './layouts/index'; // { en, ru }
import Key from './Key';

const body = document.querySelector('body');

const main = create(
  'main',
  '',
  [create('h1', 'title', 'Virtual Keyboard'),
    create('h3', 'subtitle', 'Чтобы сменить раскладку клавиатуры используем комбинацию клавиш Ctrl+Alt или нажимаем на клавишу <i class="borderButton">EN</i>/<i class="borderButton">RU</i>.'),
  ],
);

// Обертка для оутпута и клавиатуры
const keyboardFunctionalityWrapper = create('div', 'container__wrapper', '', main);

window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
export default class Keyboard {
  constructor(rowsOrder) {
    this.rowsOrder = rowsOrder;
    this.keysPressed = {};
    this.isCaps = false;
    // Спрятана клавиатура или нет
    this.isHidden = true;
    // Разрешенеие на нажатие
    this.isTap = true;
    // Нажатие клавиши Shift
    this.shiftKey = false;
    // Зажатая клавиша шифт
    this.isShift = false;
  }

  init(langCode) {
    this.keyBase = language[langCode];
    this.output = create(
      'textarea',
      'output',
      null,
      keyboardFunctionalityWrapper,
      ['rows', 5],
      ['cols', 50],
      ['spellcheck', false],
      ['autocorrect', 'off'],
    );
    this.container = create('div', 'keyboard', null, keyboardFunctionalityWrapper, ['language', langCode]);
    body.prepend(main);

    return this;
  }

  generateLayout() {
    this.keyButtons = [];
    this.rowsOrder.forEach((row, i) => {
      const rowElement = create('div', 'keyboard__row', null, this.container, ['row', i + 1]);
      rowElement.style.gridTemplateColumns = `repeat(${row.length}, 1fr)`;
      row.forEach((code) => {
        const keyObj = this.keyBase.find((key) => key.code === code);
        if (keyObj) {
          const keyButton = new Key(keyObj);
          this.keyButtons.push(keyButton);
          rowElement.appendChild(keyButton.div);
        }
      });
    });

    document.addEventListener('keydown', this.accessedTap);
    document.addEventListener('keyup', this.accessedTap);
    this.container.onmousedown = this.preHandleEvent;
    this.container.onmouseup = this.preHandleEvent;
    this.output.focus();
  }

  // Разрешение на нажатие клавиш
  accessedTap = (e) => {
    if (this.isTap) {
      this.output.removeAttribute('readonly');
      this.handleEvent(e);
    } else {
      this.output.setAttribute('readonly', true);
    }
  };

  preHandleEvent = (e) => {
    e.stopPropagation();
    const keyDiv = e.target.closest('.keyboard__key');
    if (!keyDiv) return;
    const { dataset: { code } } = keyDiv;
    keyDiv.addEventListener('mouseleave', this.resetButtonState);
    this.handleEvent({ code, type: e.type });
  };

  // Ф-я обработки событий
  handleEvent = (e) => {
    if (e.stopPropagation) e.stopPropagation();
    const { code, type } = e;
    const keyObj = this.keyButtons.find((key) => key.code === code);
    if (!keyObj) return;
    this.output.focus();

    // НАЖАТИЕ КНОПКИ
    if (type.match(/keydown|mousedown/)) {
      if (!type.match(/mouse/)) e.preventDefault();
      if (code.match(/Control|Alt|Caps/) && e.repeat) return;
      if (code.match(/Control/)) this.ctrKey = true;
      if (code.match(/Alt/)) this.altKey = true;
      if (code.match(/Control/) && this.altKey) this.switchLanguage();
      if (code.match(/Alt/) && this.ctrKey) this.switchLanguage();
      if (code.match(/RUEN/)) this.switchLanguage();

      keyObj.div.classList.add('active');

      if (code.match(/Shift/)) {
        this.shiftKey = !this.shiftKey;
        this.isShift = !this.isShift;
        if (this.isShift === true) {
          this.switchUpperCase(true);
        } else {
          this.switchUpperCase(false);
          keyObj.div.classList.remove('active');
        }
      }

      if (code.match(/Caps/) && !this.isCaps) {
        this.isCaps = true;
        this.switchUpperCase(true);
      } else if (code.match(/Caps/) && this.isCaps) {
        this.isCaps = false;
        this.switchUpperCase(false);
        keyObj.div.classList.remove('active');
      }

      // Определяем, какой символ мы пишем в консоль (спец или основной)
      if (!this.isCaps) {
        // если не зажат капс, смотрим не зажат ли шифт
        this.printToOutput(keyObj, this.shiftKey ? keyObj.shift : keyObj.small);
      } else if (this.isCaps) {
        // если зажат капс
        if (this.shiftKey) {
          // и при этом зажат шифт - то для кнопки со спецсимволом даем верхний регистр
          this.printToOutput(keyObj, keyObj.sub.innerHTML ? keyObj.shift : keyObj.small);
        } else {
          // и при этом НЕ зажат шифт - то для кнопки без спецсивмола даем верхний регистр
          this.printToOutput(keyObj, !keyObj.sub.innerHTML ? keyObj.shift : keyObj.small);
        }
      }
      this.keysPressed[keyObj.code] = keyObj;
    // ОТЖАТИЕ КНОПКИ
    } else if (e.type.match(/keyup|mouseup/)) {
      if (this.isShift) {
        if (!code.match(/ShiftLeft|ShiftRight/)) {
          this.resetPressedButtons(code);
        }
      } else {
        this.resetPressedButtons(code);
      }

      if (code.match(/Control/)) this.ctrKey = false;
      if (code.match(/Alt/)) this.altKey = false;
      if (this.isShift) {
        if (!code.match(/Caps|ShiftLeft|ShiftRight/)) keyObj.div.classList.remove('active');
      } else if (!code.match(/Caps/)) keyObj.div.classList.remove('active');
    }
  };

  resetButtonState = ({ target: { dataset: { code } } }) => {
    if (code.match(/Control/)) this.ctrKey = false;
    if (code.match(/Alt/)) this.altKey = false;
    if (!code.match(/ShiftLeft|ShiftRight/)) {
      this.resetPressedButtons(code);
    }
    this.output.focus();
  };

  resetPressedButtons = (targetCode) => {
    if (!this.keysPressed[targetCode]) return;
    if (!this.isCaps) this.keysPressed[targetCode].div.classList.remove('active');
    this.keysPressed[targetCode].div.removeEventListener('mouseleave', this.resetButtonState);
    delete this.keysPressed[targetCode];
  };

  switchUpperCase(isTrue) {
    // Флаг - чтобы понимать, мы поднимаем регистр или опускаем
    if (isTrue) {
      // Мы записывали наши кнопки в keyButtons, теперь можем легко итерироваться по ним
      this.keyButtons.forEach((button) => {
        const btn = button;
        // Если у кнопки есть спецсивол - мы должны переопределить стили
        if (button.sub) {
          // Если только это не капс, тогда поднимаем у спецсимволов
          if (this.shiftKey) {
            button.sub.classList.add('sub-active');
            button.letter.classList.add('sub-inactive');
          }
        }
        // Не трогаем функциональные кнопки
        // И если капс, и не шифт, и именно наша кнопка без спецсимвола
        if (!button.isFnKey && this.isCaps && !this.shiftKey && !button.sub.innerHTML) {
          // тогда поднимаем регистр основного символа letter
          btn.letter.innerHTML = button.shift;
        // Если капс и зажат шифт
        } else if (!button.isFnKey && this.isCaps && this.shiftKey) {
          // тогда опускаем регистр для основного симовла letter
          btn.letter.innerHTML = button.small;
        // а если это просто шифт - тогда поднимаем регистр у основного символа
        // только у кнопок, без спецсимвола --- там уже выше отработал код для них
        } else if (!button.isFnKey && !button.sub.innerHTML) {
          btn.letter.innerHTML = button.shift;
        }
      });
    } else {
      // опускаем регистр в обратном порядке
      this.keyButtons.forEach((button) => {
        const btn = button;
        // Не трогаем функциональные кнопки
        // Если есть спецсимвол
        if (button.sub.innerHTML && !button.isFnKey) {
          // то возвращаем в исходное
          if (!this.isShift) {
            button.sub.classList.remove('sub-active');
            button.letter.classList.remove('sub-inactive');
          }
          // если не зажат капс
          if (!this.isCaps) {
            // то просто возвращаем основным символам нижний регистр
            btn.letter.innerHTML = button.small;
          } else {
            // если капс зажат - то возвращаем верхний регистр
            btn.letter.innerHTML = button.shift;
          }
        // если это кнопка без спецсимвола (снова не трогаем функциональные)
        } else if (!button.isFnKey) {
          // то если зажат капс
          if (this.isCaps) {
            // возвращаем верхний регистр
            if (!this.isShift) {
              btn.letter.innerHTML = button.shift;
            } else {
              btn.letter.innerHTML = button.small;
            }
          } else {
            // если отжат капс - возвращаем нижний регистр
            // eslint-disable-next-line no-lonely-if
            if (!this.isShift) {
              btn.letter.innerHTML = button.small;
            } else {
              btn.letter.innerHTML = button.shift;
            }
          }
        }
      });
    }
  }

  switchLanguage = () => {
    const langAbbr = Object.keys(language);
    let langIdx = langAbbr.indexOf(this.container.dataset.language);
    this.keyBase = langIdx + 1 < langAbbr.length ? language[langAbbr[langIdx += 1]]
      : language[langAbbr[langIdx -= langIdx]];

    this.container.dataset.language = langAbbr[langIdx];
    storage.set('kbLang', langAbbr[langIdx]);

    this.keyButtons.forEach((button) => {
      const keyObj = this.keyBase.find((key) => key.code === button.code);
      if (!keyObj) return;
      const btn = button;
      btn.shift = keyObj.shift;
      btn.small = keyObj.small;
      if (keyObj.shift && keyObj.shift.match(/[^a-zA-Zа-яА-ЯёЁ0-9]/g)) {
        btn.sub.innerHTML = keyObj.shift;
      } else {
        btn.sub.innerHTML = '';
      }
      btn.letter.innerHTML = keyObj.small;
    });
    if (this.isCaps) this.switchUpperCase(true);
  };

  printToOutput(keyObj, symbol) {
    let cursorPos = this.output.selectionStart;
    const left = this.output.value.slice(0, cursorPos);
    const right = this.output.value.slice(cursorPos);
    const textHandlers = {
      Tab: () => {
        this.output.value = `${left}\t${right}`;
        cursorPos += 1;
      },
      ArrowLeft: () => {
        cursorPos = cursorPos - 1 >= 0 ? cursorPos - 1 : 0;
      },
      ArrowRight: () => {
        cursorPos += 1;
      },
      ArrowUp: () => {
        const positionFromLeft = this.output.value.slice(0, cursorPos).match(/(\n).*$(?!\1)/g) || [[1]];
        cursorPos -= positionFromLeft[0].length;
      },
      ArrowDown: () => {
        const positionFromLeft = this.output.value.slice(cursorPos).match(/^.*(\n).*(?!\1)/) || [[1]];
        cursorPos += positionFromLeft[0].length;
      },
      Enter: () => {
        this.output.value = `${left}\n${right}`;
        cursorPos += 1;
      },
      Delete: () => {
        this.output.value = `${left}${right.slice(1)}`;
      },
      Backspace: () => {
        this.output.value = `${left.slice(0, -1)}${right}`;
        cursorPos -= 1;
      },
      Space: () => {
        this.output.value = `${left} ${right}`;
        cursorPos += 1;
      },
    };
    if (textHandlers[keyObj.code]) textHandlers[keyObj.code]();
    else if (!keyObj.isFnKey) {
      cursorPos += 1;
      this.output.value = `${left}${symbol || ''}${right}`;
    }
    this.output.setSelectionRange(cursorPos, cursorPos);
  }
}
