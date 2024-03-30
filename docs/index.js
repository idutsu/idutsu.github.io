import { Game, Entity } from "./js/game.js";

const WINDOW_WIDTH         = window.innerWidth;
const WINDOW_HEIGHT        = window.innerHeight;
const ALLOWED_KEYS         = ["a","s","w","d","c","f","v","m","x","z"];
const PLAYER_ORIGINAL_SIZE = 1080;
const PLAYER_MIN_SIZE      = 400;
const PLAYER_SIZE          = WINDOW_WIDTH > WINDOW_HEIGHT ? Math.max(WINDOW_WIDTH / 4, PLAYER_MIN_SIZE) : Math.max(WINDOW_HEIGHT / 3, PLAYER_MIN_SIZE);

const game = Game("www.idutsu.com", WINDOW_WIDTH, WINDOW_HEIGHT);
game.addAsset("image", "idle", "images/sheet/idle.png");
game.addAsset("image", "close", "images/sheet/close.png");
game.addAsset("image", "open", "images/sheet/open.png");
game.addAsset("image", "front", "images/sheet/front.png");
game.addAsset("image", "side", "images/sheet/side.png");
game.addAsset("image", "walk", "images/sheet/walk.png");
game.addAsset("image", "sit", "images/sheet/sit.png");
game.addAsset("image", "stand", "images/sheet/stand.png");
game.addAsset("image", "arm", "images/sheet/arm.png");
game.addAsset("image", "sleep", "images/sheet/sleep.png");
game.addAsset("image", "email", "images/sheet/email.png");
game.addAsset("image", "address", "images/address.png");
game.start(rule);

function rule(){
	const getAsset  = game.getAsset;
	const addUpdate = game.addUpdateEvent;
	const remUpdate = game.removeUpdateEvent;
	const addRender = game.addRenderEvent;
	const remRender = game.removeRenderEvent;
	const addKey    = game.addPressedKey;
	const remKey    = game.removePressedKey;
	
	const idleImage      = getAsset("image", "idle");
	const closeFaceImage = getAsset("image", "close");
	const openFaceImage  = getAsset("image", "open")
	const frontFaceImage = getAsset("image", "front")
	const sideFaceImage  = getAsset("image", "side");
	const walkImage      = getAsset("image", "walk");
	const sitImage       = getAsset("image", "sit");
	const standImage     = getAsset("image", "stand");
	const foldArmImage   = getAsset("image", "arm");
	const sleepImage     = getAsset("image", "sleep");
	const emailImage     = getAsset("image", "email");
	const addressImage   = getAsset("image", "address");

	const frame2 = createPlayerFrame(2);
	const frame3 = createPlayerFrame(3);
	const frame4 = createPlayerFrame(4);
	const frame5 = createPlayerFrame(5);

	const player  = new Entity("kirikuchikun");
	player.x      = (WINDOW_WIDTH - PLAYER_SIZE) * 0.5;
	player.y      = (WINDOW_HEIGHT - PLAYER_SIZE) * 0.5;
	player.width  = PLAYER_SIZE;
	player.height = PLAYER_SIZE;

	// main update for game loop
	let unstoppable = false;	
	let isCloseFace = false;
	let isFrontFace = false;
	let isSit       = false;
	let idleTime    = 0;

	const keyevent = (deltaTime, pressedKeys) => {
		if (isPressedAllowedKeys(pressedKeys)) {
			// remove idle
			idleTime = 0;
			remUpdate(idleAnimation);
			// walking
			if (pressedKeys["a"] || pressedKeys["d"] || pressedKeys["w"] || pressedKeys["s"]) {
				addUpdate(walkAnimation);
				if (pressedKeys["a"]) {
					addUpdate(moveLeft);
				} else if (pressedKeys["d"]) {
					addUpdate(moveRight);
				} else if (pressedKeys["w"]) {
					addUpdate(moveUp);
				} else if (pressedKeys["s"]) {
					addUpdate(moveDown);
				} 
			// close or open face
			} else if (pressedKeys["c"]) {
				if (isCloseFace) {
					addUpdate(openFaceAnimation);
				} else {
					addUpdate(closeFaceAnimation);
				}
			//　side or front face
			} else if (pressedKeys["f"]) {
				if (isCloseFace) {
					if (isFrontFace) {
						addUpdate(sideFaceAnimation);
					} else {
						addUpdate(frontFaceAnimation);
					}
				}
			// sit or stand
			} else if (pressedKeys["v"]) {
				if (isSit) {
					addUpdate(standAnimation)
				} else {
					addUpdate(sitAnimation);
				}
			// fold arms
			} else if (pressedKeys["x"]) {
				addUpdate(foldArmAnimation);
			// sleep
			} else if (pressedKeys["z"]) {
				addUpdate(sleepAnimation);
			// show email address
			} else if (pressedKeys["m"]) {
				addUpdate(emailAnimation);
			}	
		} else {
			//  idle
			if (!unstoppable) idleTime += deltaTime;
			if (idleTime > 3000) addUpdate(idleAnimation);
		}
	};

	//animations
	const SPEED = 0.2;

	const moveRight = (deltaTime) => {
		player.x += deltaTime * SPEED;
		remUpdate(moveRight);
	};

	const moveLeft = (deltaTime) => {
		player.x -= deltaTime * SPEED;
		remUpdate(moveLeft);
	};

	const moveUp = (deltaTime) => {
		player.y -= deltaTime * SPEED;
		remUpdate(moveUp);
	};

	const moveDown = (deltaTime) => {
		player.y += deltaTime * SPEED;
		remUpdate(moveDown);
	};

	const idleAnimation = (() => {
		let interval = 200;
		let time = 0;
		let initialized = false;
		const update = (deltaTime) => {
			if(!initialized) {
				initialized = true;
				player.image = idleImage;
				player.frames = frame2;
				isCloseFace = false;
				isFrontFace = false;
				isSit = false;	
			}
			if (player.image === idleImage) {
				time += deltaTime;
				if (time >= interval ) {
					time -= interval;
					player.loop();
				}
			} else {
				reset();
			}
		}
		const reset = () => {
			remUpdate(update);
			time = 0;
			initialized = false;
		}
		return update;
	})();

	const walkAnimation = (() => {
		let interval = 100;
		let time = 0;
		let initialized = false;
		const update = (deltaTime) => {
			if(!initialized) {
				initialized = true;
				player.image = walkImage;
				player.frames = frame4;
				player.frameIndex = 0;
				isCloseFace = false;
				isFrontFace = false;
				isSit = false;	
			}
			if (player.image === walkImage) {
				time += deltaTime;
				if (time >= interval ) {
					time -= interval;
					player.advance(reset);
				}
			} else {
				reset();
			}
		}
		const reset = () => {
			remUpdate(update);
			player.frameIndex = 0;
			time = 0;
			initialized = false;
		}
		return update;
	})();

	const closeFaceAnimation = (() => {
		let interval = 100;
		let time = 0;
		let initialized = false;
		const update = (deltaTime) => {
			if(!initialized) {
				initialized = true;
				player.image = closeFaceImage;
				player.frames = frame3;
			}
			if (player.image === closeFaceImage) {
				time += deltaTime;
				if (time >= interval ) {
					time -= interval;
					player.advance(() => {
						isCloseFace = true;
						reset();
					});
				}	
			} else {
				reset();
			}
		}
		const reset = () => {
			remUpdate(update);
			time = 0;
			initialized = false;
		}
		return update;
	})();

	const openFaceAnimation = (() => {
		let interval    = 100;
		let time        = 0;
		let initialized = false;
		const update = (deltaTime) => {
			if(!initialized) {
				initialized = true;
				player.image = openFaceImage;
				player.frames = frame3;
			}
			if (player.image === openFaceImage) {
				time += deltaTime;
				if (time >= interval ) {
					time -= interval;
					player.advance(() => {
						isCloseFace = false;
						reset();
					});
				}
			} else {
				reset();
			}
		}
		const reset = () => {
			remUpdate(update);
			time = 0;
			initialized = false
		}
		return update;
	})();

	const frontFaceAnimation = (() => {
		let interval = 100;
		let time = 0;
		let initialized = false;
		const update = (deltaTime) => {
			if(!initialized) {
				initialized = true;
				player.image = frontFaceImage;
				player.frames = frame3;
			}
			if (player.image === frontFaceImage) {
				time += deltaTime;
				if (time >= interval ) {
					time -= interval;
					player.advance(() => {
						isFrontFace = true;
						reset();
					});
				}
			} else {
				reset();
			}
		}
		const reset = () => {
			remUpdate(update);
			time = 0;
			initialized = false;
		}
		return update;
	})();

	const sideFaceAnimation = (() => {
		let interval = 100;
		let time = 0;
		let initialized = false;
		const update = (deltaTime) => {
			if(!initialized) {
				initialized = true;
				player.image = sideFaceImage;
				player.frames = frame3;
			}
			if (player.image === sideFaceImage) {
				time += deltaTime;
				if (time >= interval ) {
					time -= interval;
					player.advance(() => {
						isFrontFace = false;
						reset();
					});
				}
			} else {
				reset();
			}
		}
		const reset = () => {
			remUpdate(update);
			time = 0;
			initialized = false;
		}
		return update;
	})();

	const sitAnimation = (() => {
		let interval = 100;
		let time = 0;
		let initialized = false;
		const update = (deltaTime) => {
			if(!initialized) {
				initialized = true;
				player.image = sitImage;
				player.frames = frame5;
			}
			if (player.image === sitImage) {
				time += deltaTime;
				if (time >= interval ) {
					time -= interval;
					player.advance(() => {
						isSit = true;
						reset();
					});
				}
			} else {
				reset();
			}
		}
		const reset = () => {
			remUpdate(update);
			time = 0;
			initialized = false;
		}
		return update;
	})();

	const standAnimation = (() => {
		let interval = 100;
		let time = 0;
		let initialized = false;
		const update = (deltaTime) => {
			if(!initialized) {
				initialized = true;
				player.image = standImage;
				player.frames = frame5;
			}
			if (player.image === standImage) {
				time += deltaTime;
				if (time >= interval ) {
					time -= interval;
					player.advance(() => {
						isSit = false;
						reset();
					});
				}
			} else {
				reset();
			}
		}
		const reset = () => {
			remUpdate(update);
			time = 0;
			initialized = false;
		}
		return update;
	})();

	const sleepAnimation = (() => {
		let interval = 100;
		let time = 0;
		let initialized = false;
		const update = (deltaTime) => {
			if(!initialized) {
				initialized = true;
				player.image = sleepImage;
				player.frames = frame5;
			}
			if (player.image === sleepImage) {
				time += deltaTime;
				if (time >= interval ) {
					time -= interval;
					player.advance(reset);
				}
			} else {
				reset();
			}
		}
		const reset = () => {
			remUpdate(update);
			time = 0;
			initialized = false;
		}
		return update;
	})();

	const foldArmAnimation = (() => {
		let interval = 100;
		let time = 0;
		let initialized = false;
		const update = (deltaTime) => {
			if(!initialized) {
				initialized = true;
				player.image = foldArmImage;
				player.frames = frame4;
			}
			if (player.image === foldArmImage) {
				time += deltaTime;
				if (time >= interval ) {
					time -= interval;
					player.advance(reset);
				}
			} else {
				reset();
			}
		}
		const reset = () => {
			remUpdate(update);
			time = 0;
			initialized = false;
		}
		return update;
	})();

	const emailAnimation = (() => {
		const email  = new Entity("email");
		email.image  = addressImage;
		email.width  = WINDOW_WIDTH;
		email.height = WINDOW_WIDTH / (email.image.width / email.image.height);
		email.x      = 0;
		email.y      = (WINDOW_HEIGHT - email.height) / 2;

		let interval = 100;
		let initialized = false;
		let time = 0;
		let showEmailAddressReady = false;
		let showEmailAddressInitialized = false;
		let showEmailAddressTime = 0;

		const update = (deltaTime) => {
			if (!initialized) {
				unstoppable = true;
				initialized = true;
				player.image = emailImage;
				player.frames = frame3;
			}
			if (player.image === emailImage) {
				time += deltaTime;
				if (time >= interval) {
					time -= interval;
					player.advance(() => showEmailAddressReady = true);					
				}
				if (showEmailAddressReady) showEmailAddress(deltaTime);
			} else {
				reset();
			}
		};

		const drawEmail = (ctx) => {
			const image   = email.image;
			const dx      = email.x;
			const dy      = email.y;
			const dWidth  = email.width;
			const dHeight = email.height;
			ctx.drawImage(image, dx, dy, dWidth, dHeight);	
		};

		const showEmailAddress = (deltaTime) => {
			showEmailAddressTime += deltaTime;
			if (showEmailAddressTime > 1000) {
				if (!showEmailAddressInitialized) {
					showEmailAddressInitialized = true;
					addRender(drawEmail);
				} 
			}
		}

		const reset = () => {
			unstoppable = false;
			remRender(drawEmail);
			remUpdate(update);
			initialized = false;
			time = 0;
			showEmailAddressReady = false;
			showEmailAddressInitialized = false;
			showEmailAddressTime = 0;
		}

		return update;
	})();

	// main render for game loop
	const drawPlayer = (ctx) => {
		const image   = player.image;
		const frame   = player.frames[player.frameIndex];
		const sx      = frame[0];
		const sy      = frame[1];
		const sWidth  = frame[2];
		const sHeight = frame[3];
		const dx      = frame[4] || player.x;
		const dy      = frame[5] || player.y;
		const dWidth  = frame[6] || player.width;
		const dHeight = frame[7] || player.height;
		ctx.drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);	
	};

  	// add update and render for game loop
	addUpdate(keyevent);
	addUpdate(idleAnimation);
	addRender(drawPlayer);

	// events for touch screen
	document.addEventListener("mousedown", addKeyHandler);
	document.addEventListener("touchstart", addKeyHandler, { passive: false });
	document.addEventListener("mouseup", remKeyHandler);
	document.addEventListener("touchend", remKeyHandler);
	if ('ontouchstart' in window) document.getElementById('btns').style.display = 'block';
	
	// functions
	function addKeyHandler(event){
		const key = event.target.getAttribute("data-key")
		if (key) {
			if(event.type === "touchstart") {
				event.preventDefault();
			}	
			addKey(key);
		}
	};

	function remKeyHandler(event){
		const key = event.target.getAttribute("data-key")
		if (key) {
			if(event.type === "touchstart") {
				event.preventDefault();
			}	
			remKey(key);
		}
	};

	function createPlayerFrame(length){
		const frames = []
		for (let i=0; i<length; i++) {
			const frame = [];
			frame[0] = i * PLAYER_ORIGINAL_SIZE;
			frame[1] = 0;
			frame[2] = PLAYER_ORIGINAL_SIZE;
			frame[3] = PLAYER_ORIGINAL_SIZE;
			frames.push(frame);
		}
		return frames;
	};

	function isPressedAllowedKeys(pressedKeys){
		const isAllowedKeyPressed = Object.keys(pressedKeys).some(key => ALLOWED_KEYS.includes(key) && pressedKeys[key]);
		const noDisallowedKeysPressed = Object.entries(pressedKeys).every(([key, value]) => !value || ALLOWED_KEYS.includes(key));
		return isAllowedKeyPressed && noDisallowedKeysPressed;
	};
};