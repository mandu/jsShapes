/* jsShapes
 * Author:  Mikko Haavisto
 * Mail:    mikko.haavisto at lut.fi
 *
 * Description: Prevent blocks from moving to the bottom.
 *              Also fancy weapon included. :)
 *              LocalStorage used for saving rankings.
 */

var jsShapes = {};
jsShapes.DEBUG = true; // displays info to console

// yellow, green, orange1, orange2, blue1, blue2, purple1, purple2
var colors  = [ ['#f5eb00', '#ddd100', '#c5bc00', '#948d00', '#635c01', '#4b4700'],
                ['#8cba00', '#7ba900', '#6e9601', '#537100', '#374c01', '#2a3701'],
                ['#f58400', '#dc7800', '#c36b01', '#924f00', '#623400', '#492600'],
                ['#f04800', '#d94102', '#c13a00', '#912c00', '#5f1c00', '#481502'],
                ['#004a65', '#00425a', '#013b4f', '#002b3b', '#001e28', '#001720'],
                ['#010082', '#000074', '#000166', '#010050', '#000032', '#010029'],
                ['#ae0045', '#9c003d', '#8b0037', '#670129', '#45001c', '#330011'],
                ['#8b0067', '#7b005a', '#6c0151', '#54003d', '#370028', '#2b001e'] ];

/* Utilities */
var utils = (function namespace() {
    function randomRange(minValue, maxValue) { return Math.round(minValue + Math.random() * (maxValue - minValue)); }
    function randomOdds(var1, var2, odds) { return (Math.random() < odds) ? var1 : var2; }

    function fadeOut(e) {
        // reduce opacity by nonlinear method
        function f(remaining) { e.style.opacity = String(1 - Math.sqrt(remaining)); }
        function cb() {
            e.style.visibility = 'hidden'; // hide element and set opacity back to 1
            e.style.opacity = '1'; // if both opacity and visibility are hidden/0, can be tricky in future
        }
        animateHelper(e, f, cb);
    }

    function fadeIn(e) {
        function f(remaining) {
            // set opacity to 0 and visibility
            e.style.opacity = '0';
            e.style.visibility = 'visible';
            // add opacity by nonlinear method, log(e) = 1
            e.style.opacity = String(Math.log(remaining * Math.E));
        }
        function cb() { e.style.opacity = '1'; }
        animateHelper(e, f, cb);
    }

    function shake(e, intensity) {
        intensity = intensity || 2;
        // Move element randomly to left (+/-) to make shake effect
        function f() {
            var test = Math.round(Math.sin(2 * Math.PI * Math.random()) * intensity);
            e.style.left = String(test + 'px');
            }
        function cb() { e.style.left = '0'; }
        animateHelper(e, f, cb);
    }

    function animateHelper(e, f, callback) {
        // e = element, f = function to loop, callback = function after loop
        var start = (new Date()).getTime(), // returns time in ms
            time = 500; // 0.5s
        animate();

        function animate () {
            // every 'loop' calculates elapsed time
            var elapsed = (new Date()).getTime() - start,
                remaining = elapsed / time; // if remaining > 1, time is passed

            if (remaining < 1) {
                f(remaining);
                setTimeout(animate, 20); // call function again with setTimeout
            } else {
                callback();
            }
        }
    }

    return {
        randomRange: randomRange,
        randomOdds: randomOdds,
        fadeOut: fadeOut,
        fadeIn: fadeIn,
        shake: shake
    };


}());

// id selector shortcut, $('id')
var $ = (function(id) { return document.getElementById(id); });


/* Prototypes starts */

/* Abstract GameElement prototype */
var GameElement = (function namespace() {
    // Abstract constructor
    function GameElement() { throw new Error("Can't instantiate from abstract prototype!"); }

    GameElement.prototype = {
        /* Constructor */
        constructor: GameElement,

        /* Properties */
        x: 0, y: 0, dx: 0, dy: 0, size: 0, step: 0, speed: 0, hit: false,
        offset: [], edge: [], shape: 'rectangle', color: '#000000',

        /* Methods */
        reset:  function () {
            this.x = 0;
            this.y = 0;
            this.dx = 0;
            this.dy = 0;
            this.size = 0;
            this.step = 0;
            this.speed = 0;

            return this; // method chaining
        },

        draw:   function (ctx) {
            ctx.save(); // saves canvas style before drawing
            ctx.fillStyle = this.color;
            ctx.beginPath();

            if (this.shape === 'circle') { ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2, true); }
            if (this.shape === 'rectangle') { ctx.rect(this.x, this.y, this.size, this.size); }

            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = "#000000";
            ctx.stroke(); // border

            ctx.restore(); // restores state

            return this; // method chaining
        },

        move:   function (direction) {
            if (direction === 'left' && this.dx > -this.step) {
                this.dx -= this.step;
            } else if (direction === 'right' && this.dx < this.step) {
                this.dx += this.step;
            } else if (direction === 'up' && this.dy > -this.step) {
                this.dy -= this.step;
            } else if (direction === 'down' && this.dy < this.step) {
                this.dy += this.step;
            }
            return this; // method chaining
        },

        advance: function () {
            // If object type is Bullet, some changes to advance function.
            // Keep dx/dy values constant. When bullet touches wall, its dy/dx gets value = 0

            // 0, 1, 2, 3 = up, down, left, right
            // Circle this.x, this.y points in middle of the circle
            // Rectangle this.x, this.y points in topleft corner
            this.offset[0] = (this.shape === 'circle') ? this.y - this.size : this.y;
            this.offset[1] = this.y + this.size + this.speed;
            this.offset[2] = (this.shape === 'circle') ? this.x - this.size : this.x;
            this.offset[3] = this.x + this.size + this.speed;

            this.edge[0] = (this.shape === 'circle') ? this.y - this.size : this.y;
            this.edge[1] = jsShapes.height - this.y - this.size;
            this.edge[2] = (this.shape === 'circle') ? this.x - this.size : this.x;
            this.edge[3] = jsShapes.width - this.x - this.size;

            // Moving up
            if (this.dy < 0) {
                if (this.offset[0] >= this.speed) { // room for subtract
                    this.y -= this.speed;
                    // Keep Bullet dx/dy values constant
                    if (!(this instanceof Bullet)) { this.dy += this.speed; } else { /* Dummy */ }
                } else { //near edge
                    this.y -= this.edge[0];
                    this.dy = 0;
                }
            }

            // Moving down
            if (this.dy > 0) {
                if (this.offset[1] <= jsShapes.height) { // room for subtract
                    this.y += this.speed;
                    // Keep Bullet dx/dy values constant
                    if (!(this instanceof Bullet)) { this.dy -= this.speed; } else { /* Dummy */ }
                } else { // near edge
                    this.y += this.edge[1];
                    this.dy = 0;
                }
            }

            // Moving left
            if (this.dx < 0) {
                if (this.offset[2] >= this.speed) { // room for subtract
                    this.x -= this.speed;
                    // Keep Bullet dx/dy values constant
                    if(!(this instanceof Bullet)) { this.dx += this.speed; } else { /* Dummy */ }
                } else { //near edge
                    this.x -= this.edge[2];
                    this.dx = 0;
                }
            }

            // Moving right
            if (this.dx > 0) {
                if (this.offset[3] <= jsShapes.width) { // room for subtract
                    this.x += this.speed;
                    // Keep Bullet dx/dy values constant
                    if(!(this instanceof Bullet)) { this.dx -= this.speed; } else { /* Dummy */ }
                } else { // near edge
                    this.x += this.edge[3];
                    this.dx = 0;
                }
            }

            return this; // method chaining
        },

        collision: function (o) { // calculates collision with o(x, y)
            if (this.shape === 'circle') {// point (x,y) in circle
                return (Math.pow(o.x - this.x, 2) + Math.pow(o.y - this.y, 2) <= Math.pow(this.size, 2));
            }
            if (this.shape === 'rectangle') {// straightforward test, (x,y) in rectangle
                return ((o.x >= this.x && o.x <= this.x + this.size) && (o.y >= this.y && o.y <= this.y + this.size));
            }
        }
    };

    return GameElement;
}());

/* Player prototype */
var Player = (function namespace() {
    // Constructor calls the reset function
    function Player() { this.reset.call(this); }
    // Inherits from abstract GameElement
    Player.prototype = Object.create(GameElement.prototype);
    // Set constructor
    Player.prototype.constructor = Player;
    // Set init values
    Player.prototype.reset = (function () {
        this.x = 400;
        this.y = 380;
        this.size = 10;
        this.step = 5; // 500 => always on move
        this.speed = 5;
        this.score = 0;
        this.shape = 'circle';
        this.color = colors[utils.randomRange(0, colors.length - 1)][1];
        this.name = this.name || ""; // if name exists, don't change it
    });

    return Player;
}());

/* Bullet prototype */

var Bullet = (function namespace() {
    // Constructor calls the  function
    function Bullet(player) {
        // Inherits players current state. Bullet will advance
        // the player's current course.
        this.x = player.x;
        this.y = player.y;
        this.dx = player.dx;
        this.dy = player.dy;
        this.speed = 10;
        this.size = 4;
        this.shape = 'circle';
    }
    // Inherits from abstract GameElement
    Bullet.prototype = Object.create(GameElement.prototype);
    // Set constructor
    Bullet.prototype.constructor = Bullet;
    Bullet.prototype.isMoving = (function () {
        return (this.dx !== 0 || this.dy !== 0);
    });

    return Bullet;
}());

/* Opponents prototype */
var Opponent = (function namespace() {
    // Constructor calls the reset function
    function Opponent(level) { this.reset.call(this, level); }
    // Inherits from abstract GameElement
    Opponent.prototype = Object.create(GameElement.prototype);
    // Set constructor
    Opponent.prototype.constructor = Opponent;
    // Set init values
    Opponent.prototype.reset = (function (level) {
        var i, j;
        // Opponent init by randomizer functions
        if (!level) { level = 1; } // default level
        this.shape =  utils.randomOdds('circle', 'rectangle', 0.5);
        this.step = utils.randomRange(level / 2, level);
        this.size = utils.randomRange((40 / Math.sqrt(level)), (100 - level * 3));
        this.speed =  this.step / 2;
        this.x = (this.shape === 'circle') // depends on shape and size
            ? utils.randomRange((this.size / 2), jsShapes.width - (this.size / 2))
            : utils.randomRange(0, jsShapes.width - this.size);
        // color group changes every level, color in group is random
        // after level9, only dark colors
        i = (level < 9) ? Math.round(level - 1) : utils.randomRange(0, 7);
        j = (level < 9) ? utils.randomRange(0, 5) : 5;
        this.color = colors[i][j];
    });
    
    Opponent.prototype.onBottomEdge = (function () {
        return (this.y === jsShapes.height - this.size);
    });

    return Opponent;
}());

/* Prototypes ends */

/* Game module */
jsShapes.game = (function namespace() {
    // game variables
    var player, opponents = [], bullet = [], i,
        // elements
        el = {      ctx: null,
                    canvas: null,
                    scoreField: null,
                    playerField: null,
                    playerContainer: null,
                    playerInput: null },
        // modules
        mod = {     controls: null,
                    ranking: null,
                    messages: null },

        // misc variables
        misc = {    level: null,
                    levelPrev: null,
                    frames: null,
                    frame: null,
                    framehistory: null,
                    frameloop: null,
                    fpsloop: null,
                    overheat: null,
                    overheatTimer: null };

    // function properties
    jsShapes.running = false;
    jsShapes.width = 1000;
    jsShapes.height = 500;
    jsShapes.activeDirection = [false, false, false, false]; // up, down, left, right
    jsShapes.shooting = false;

    function render() {
        el.ctx.clearRect(0, 0, jsShapes.width, jsShapes.height); // clears canvas
        player.draw(el.ctx); // draws player to canvas
        for (i = 0; i < opponents.length; i++) { opponents[i].draw(el.ctx); } // draws opponents to canvas
        for (i = 0; i < bullets.length; i++) { bullets[i].draw(el.ctx); } // draws bullets to canvas
    }

    function controller() {
        if (jsShapes.activeDirection[0]) { player.move('up'); }
        if (jsShapes.activeDirection[1]) { player.move('down'); }
        if (jsShapes.activeDirection[2]) { player.move('left'); }
        if (jsShapes.activeDirection[3]) { player.move('right'); }
        if (jsShapes.shooting && jsShapes.running) { shoot(); }
    }

    function start() {
        // if restarting game, submit score
        if(jsShapes.running) { gameOver(); }

        // initialize values
        jsShapes.running = true;
        el.scoreField.innerHTML = '0';
        misc = {    overheat: false,
                    level: 1,
                    frames: 0,
                    framehistory: 1,
                    fpsloop: setInterval(fps, 1000) }; // prints fps to console every 0.5second

        player.reset();
        mod.messages.reset();
        bullets = [];
        opponents = [new Opponent(misc.level)];
        el.canvas.style.borderColor = colors[0][2];

        resolution(); // check resolution
        // display message
        mod.messages.add({text: 'Game Started. Good Luck!', id: 'message-start'});
        if(jsShapes.DEBUG) { console.log('Game Started! Good Luck!'); }
    }

    function validate(value) {
        // trim trailing and cut extra middle whitespaces(\s)
        value = value.replace(/^\s*|\s*$/g, "").replace(/\s+/g, " ");
        // from beginning to end will match pattern (1 or [a-zA-ZöäåÄÖÅ] character
        // followed by 0 or 1 whitespace) 1 or more times
        return (value.match(/^([a-zA-ZöäåÄÖÅ]+\s?)+$/) && value.length < 21) ? value : false;
    }

    function enterKey() {
        value = validate(el.playerInput.value);
        
        if (value) {
            el.playerInput.blur();
            player.name = value;
            el.playerField.innerHTML = player.name;
            utils.fadeOut(el.playerContainer);

            el.canvas.focus();

            start();// (re)start game
        } else {
            // display message
            mod.messages.add({text: 'Incorrect Input', id: 'message-valid-error' });
            if(jsShapes.DEBUG) { console.log('Incorrect Input'); }
        }
    }

    function gameOver() {
        // Updates scores, simple validation
        if (player.name && player.score > 0 && jsShapes.running) {
            mod.ranking.add(player.name, player.score);
            mod.ranking.update();
        }
        clearTimeout(misc.fpsloop);
        jsShapes.running = false;

        // display message
        mod.messages.add({text: 'Game Over', id: 'message-go'});
        if(jsShapes.DEBUG) { console.log('Game Over'); }
    }

    function shoot() {
        if(misc.overheat && !misc.overheatTimer) {
            // After 5sec, sets overheat and overheatTimer to false.
            // overheatTimer prevent overlapping overheats.
            misc.overheatTimer = setTimeout(function() { misc.overheat = misc.overheatTimer = false; }, 5000);

            // display message
            mod.messages.add({text: 'Weapon Overheated! Wait 5 seconds!', id: 'message-weapon-o'});
            if (jsShapes.DEBUG) { console.log('Weapon Overheated! Wait 5 seconds!'); } else {/* Dummy */ }
        } else if (misc.overheat) { utils.shake(el.canvas, 8); // intensity = 8, inform player about a weapon overheating
        } else { bullets.push(new Bullet(player)); }

        if (bullets.length > 20) { misc.overheat = true; }
    }

    function fps() {
        // prints fps to console every second
        misc.frame = (misc.frames - misc.framehistory);
        misc.framehistory = misc.frames;

        if (jsShapes.DEBUG) { console.log('fps: ' + misc.frame); }
    }

    function levelUp() {
        misc.level = Math.round(player.score / 10 + 0.5); // rounds up
        if (misc.level !== misc.levelPrev) {
            misc.levelPrev = misc.level;
            // change canvas border color
            el.canvas.style.borderColor = (misc.level < 9) ? colors[misc.level - 1][2] : '#000000';

            // display message
            mod.messages.add({text: 'Current level: ' + misc.level, id: 'message-level-' + misc.level });
            if (jsShapes.DEBUG) { console.log("Level: " + misc.level); }
        }
    }
    function addScore() {
        player.score++;
        el.scoreField.innerHTML = player.score;
        utils.shake(el.scoreField);
    }

    function resolution() {
        var iHeight = window.innerHeight,
            iWidth = window.innerWidth;

        if (iHeight < 840 || iWidth < 1220) {
            // display message
            mod.messages.add({text: 'Low resolution. Try fullscreen(F11).', id: 'message-resolution' });
            if (jsShapes.DEBUG) { console.log('Low resolution. Try fullscreen(F11).'); }
        }

    }

    // gameloop
    function gameLoop() {
        misc.frames++;
        levelUp();
        render();
        mod.messages.update();
        player.advance();

        // bullets advance and check if not moving
        bullets.forEach(function (bull) {
            bull.advance();
            if (!bull.isMoving()) { bull.hit = true; }
        });

        // Iterate through opponents
        opponents.forEach(function (opp, i, oppArray) {
             // If opponent collided to wall -> gameOver
            if (opp.onBottomEdge()) { gameOver(); }
            // Else, move opponent
            else { opp.advance().move('down'); }

            // Delete opponents by hit
            if (opp.collision(player)) {
                // Player collision
                opp.hit = true;
                addScore();

                if(jsShapes.DEBUG) { console.log('Player Hit!'); }

            } else {
                // Iterate through bullets
                bullets.forEach(function (bull, j, bullArray) {
                    if (opp.collision(bull)) {
                        // Bullet collision
                        opp.hit = true;
                        bull.hit = true;
                        addScore();

                        if(jsShapes.DEBUG) { console.log('Bullet Hit!'); }
                    }
                });
            }
        });

        // Remove objects who got hit
        opponents = opponents.filter(function (o) { return o.hit === false; });
        bullets = bullets.filter(function (o) { return o.hit === false; });

        // 1% odds to create a new opponent every round
        if (utils.randomOdds(true, false, 0.01)) { opponents.push(new Opponent(misc.level)); }

    }

    // basic loop
    function loop() {
        controller(); // Respond to current user input
        if (jsShapes.running) { gameLoop(); }
        // Better performance than setInterval
        requestAnimFrame(loop);
    }

    // initialize game features
    function init() {
        el.canvas = $('game');
        el.canvas.width = jsShapes.width;
        el.canvas.height = jsShapes.height;
        el.scoreField = $('score-field');
        el.playerField = $('player-field');
        el.playerInput = $('name');
        el.playerContainer = $('name-container');
        el.ctx = el.canvas.getContext('2d');

        player = new Player();
        mod.controls = jsShapes.controls();
        mod.ranking = jsShapes.ranking();
        mod.messages = jsShapes.messages();

        // register keyHandler listeners
        document.onkeydown = mod.controls.keyPress;
        document.onkeyup = mod.controls.keyRelease;
        // change name by clicking name element
        el.playerField.onclick = (function () { gameOver(); inputFocus(); });
        // display validation result to user
        el.playerInput.onkeyup = (function () { el.playerInput.className = (validate(el.playerInput.value)) ? 'valid' : 'warning'; });

        // fadeIn and focus to name input
        var inputFocus = (function f() {
            utils.fadeIn(el.playerContainer);
            el.playerInput.focus();
            return f; // for later use
        }());

        // check resolution
        resolution();

        // display message
        mod.messages.add({text: 'Game Initialized', id: 'message-game-init' });
        if(jsShapes.DEBUG) { console.log('Game Initialized'); }

        // start basic loop which manages controls and gameloop
        loop();
    }
    return {
        init: init,
        start: start,
        enterKey: enterKey,
        gameOver: gameOver
    };

}());

/* Controls module */
jsShapes.controls = (function namespace() {
    function keyPress(e) {
        keyHelper(e, true);
        if (e.keyCode == 27) { jsShapes.game.gameOver(); } // esc key
        if (e.keyCode == 13) { jsShapes.game.enterKey(); } // enter key
    }

    function keyRelease(e) {
        keyHelper(e, false);
    }

    function keyHelper(e, bool) {
        // Helper function for common tasks
        if (!e) { e = window.event; } // IE...not working
        if (e.keyCode == 38 || e.keyCode == 87) { jsShapes.activeDirection[0] = bool; } // up arrow or w
        if (e.keyCode == 40 || e.keyCode == 83) { jsShapes.activeDirection[1] = bool; } // down arrow or a
        if (e.keyCode == 37 || e.keyCode == 65) { jsShapes.activeDirection[2] = bool; } // left arrow
        if (e.keyCode == 39 || e.keyCode == 68) { jsShapes.activeDirection[3] = bool; } // right arrow
        if (e.keyCode == 32) { jsShapes.shooting = bool; } //space key
    }

    return {
        keyPress: keyPress,
        keyRelease: keyRelease
    };
});


/* Ranking module */
jsShapes.ranking = (function namespace() {
    var ranking = 5, ul = $('ranking'), item, li, i, scores = [];

    function add(playerName, score){
        var time = new Date();
        item = { date: getTime(time), score: score, name: playerName };
        item.id = 'ranking-' + time.getTime();
        item.display = false; // default value

        item.content = '<span class="points">' + item.score + ' pts</span> '
                    + '<span class="name">' + item.name + '</span> '
                    + '<span class="date">' + item.date + '</span>';

        scores.push(item); // Add new item
        // sort list by comparing scores
        scores.sort(function (a, b) { return b.score - a.score; });
    }

    function update() {

        scores.forEach(function (item, index) {

            // append new result
            if (!item.display) {
                li = document.createElement('li');
                li.innerHTML = item.content;
                ul.insertBefore(li, ul.childNodes[index]);
                utils.fadeIn(li);
                item.display = true;
            }
        });

        if(scores.length > ranking) {
            ul.removeChild(ul.lastChild);
            scores = scores.splice(0, ranking);
        }
        
        // Save scores to localStorage
        localStorage.setItem('topten', JSON.stringify(scores));
    }

    getTime = (function (time) {
        var fixedTime = [time.getDate(), time.getMonth() + 1, time.getFullYear(), time.getHours(), time.getMinutes(), time.getSeconds()];
        // Fix one number presentation
        fixedTime.forEach(function (value, index, array) {
            array[index] = (value.toString().length === 1) ? '0' + value.toString() : value;
        });
        // date to '10.10.2011 12:42:32'
        return fixedTime[0] + '.' + fixedTime[1] + '.' + fixedTime[2] + ' ' + fixedTime[3] + ':' + fixedTime[4] + ':' + fixedTime[5];
    });

    (function init() {
        var scores_tmp = JSON.parse(localStorage.getItem('topten'));

        for (item in scores_tmp) {
            scores_tmp[item].display = false; 
            scores.push(scores_tmp[item]);
        }        
        // Update scoreboard
        update();
    }());

    return {
        add: add,
        update: update
    };
});

/* Messages module */
jsShapes.messages = (function namespace() {
        var messages = [], ul = $('messages'), li, now;

    function add(m) {
        function exist(e) { return (e.id === m.id); }
        // tests duplicated messages
        if(!messages.some(exist)) {
            m.time = (new Date()).getTime();
            m.fade = false;

            messages.push(m);
            // Show messages
            li = document.createElement('li');
            li.id = m.id;
            li.innerHTML = m.text;
            ul.appendChild(li);
            utils.fadeIn(li);
        }
    }

    function update() {
        // Removes old messages
        now = (new Date()).getTime();

        messages.forEach(function (m, i) {
            li = $(m.id);
            if (now - m.time > 5500) {
                delete messages[i];
                ul.removeChild(li);
            } else if(now - m.time > 5000 && !m.fade) {
                // starts fadeOut effect 1s before removing
                m.fade = true;
                utils.fadeOut(li);
            }
        });
        // Removes undefined from list.
        messages = messages.filter(function (m) { return m !== undefined; });
    }

    function reset() {
        messages = [];
        ul.innerHTML = '';
    }

    return {
        add: add,
        update: update,
        reset: reset
    };
});

window.onload = (function namespace() {
    window.requestAnimFrame = (function () {
        return window.requestAnimationFrame||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame    ||
        window.oRequestAnimationFrame      ||
        window.msRequestAnimationFrame;
    }());

    jsShapes.game.init();
});
