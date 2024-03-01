const ASSET_TYPE_IMAGE = "image";
const ASSET_TYPE_VIDEO = "video";
const ASSET_TYPE_AUDIO = "audio";

class Entity {
	constructor(name, image, frames) {
		this.name = name;
		this._image = image;
		this.frames = frames;
		this.frameIndex = 0;
		this.x = 0;
		this.y = 0;
		this.width = 0;
		this.height = 0;
		this.events = {};
		this.isAdvance = false;
		this.isLoop = false;
	}

	get image() {
		return this._image;
	}

	set image(image) {
		this._image = image;
		this.frameIndex = 0;
	}

	reset() {
		this.frameIndex = 0;
	}

	advance(callback) {
		if (this.frameIndex < this.frames.length - 1) {
			this.isAdvance = true;
			this.frameIndex ++;
		} else {
			this.isAdvance = false;
			if (callback && typeof callback === "function") callback();
		}
	}

  	loop(callback) {
		if (this.frameIndex < this.frames.length - 1) {
			this.isLoop = true;
			this.frameIndex ++;
		} else {
			this.isLoop = false;
			this.frameIndex = 0;
			if (callback && typeof callback === "function") callback();
		}
  	}
}

const Canvas = (canvasId) => {
	const canvas = document.getElementById(canvasId);
	const ctx = canvas.getContext("2d");

	const clear = () => {
		ctx.clearRect(0, 0, canvas.width, canvas.height);
	};

	const image = (image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight) => {
		ctx.drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);	
	};

	const resize = (width, height) => {
		canvas.width = width;
		canvas.height = height;
	};

	return {
		ctx,
		clear,
		image,
		resize,
	};
};

const Game = (canvasId, width, height) => {
	
	const canvas = Canvas(canvasId);
	const ctx = canvas.ctx;
	canvas.resize(width, height);

	const assets = {
		[ASSET_TYPE_IMAGE]: {},
		[ASSET_TYPE_AUDIO]: {},
		[ASSET_TYPE_VIDEO]: {},
	};
	let lastTime = 0;
	let pressedKeys = {};
	let updates = [];
	let renders = [];
	let events = {};

	const loop = (timestamp) => {
		if (lastTime === 0) lastTime = timestamp;
		const deltaTime = timestamp - lastTime;
		//console.log(deltaTime);
		if (deltaTime > 0) {
			canvas.clear();
			updates.forEach((update) => update(deltaTime, pressedKeys));
			renders.forEach((render) => render(ctx));
		}
		lastTime = timestamp;
		requestAnimationFrame(loop);	
	};
	
	const addAsset = (type, name, src) => {
		if (![ASSET_TYPE_IMAGE, ASSET_TYPE_VIDEO, ASSET_TYPE_AUDIO].includes(type)) {
			throw new Error(`The first argument must be ${ASSET_TYPE_IMAGE} or ${ASSET_TYPE_VIDEO} or ${ASSET_TYPE_AUDIO}.`);
		}
		if (!assets[type][name]) {
			assets[type][name] = {};
		}
		assets[type][name]["src"] = src;
		assets[type][name]["asset"] = null;
	};

	const getAsset = (type, name) => {
		return assets[type][name]["asset"];
	};
	
	const getPressedKeys = () => {
		return pressedKeys;
	};

	const start = (rule) => {
		const promises = [];

		Object.keys(assets).forEach((key) => {
			if (key === ASSET_TYPE_IMAGE) {
				const images = assets[ASSET_TYPE_IMAGE];
				Object.keys(images).forEach((key) => {
					promises.push(
						new Promise((resolve, reject) => {
							const image = new Image();
							image.onload = () => {
								console.log(`Image: ${key}: ${images[key]["src"]} loaded.`);
								resolve({ type: ASSET_TYPE_IMAGE, name: key, asset: image });
							};
							image.onerror = () => {
								reject(new Error(`Failed to load image: ${images[key]["src"]}`));
							};
							image.src = images[key]["src"];
						})
					);
				});
			} else if (key === ASSET_TYPE_VIDEO) {
				const videos = assets[ASSET_TYPE_VIDEO];
				Object.keys(videos).forEach((key) => {
					promises.push(
						new Promise((resolve, reject) => {
							const video = document.createElement("video");
							video.onloadeddata = () => {
								console.log(`Video: ${key}: ${videos[key]["src"]} loaded`);
								resolve({ type: ASSET_TYPE_VIDEO, name: key, asset: video });
							}; 
							video.onerror = () => {
								reject(new Error(`Failed to load video: ${videos[key]["src"]}`));
							};
							video.src = videos[key]["src"];	
						})
					);
				});
			} else if (key === ASSET_TYPE_AUDIO) {
				const audios = assets[ASSET_TYPE_AUDIO];
				Object.keys(audios).forEach((key) => {
					promises.push(
						new Promise((resolve, reject) => {
							const audio = new Audio();
							audio.onloadeddata = () => {
								console.log(`Audio: ${key}: ${audios[key]["src"]} loaded`);
								resolve({ type: ASSET_TYPE_AUDIO, name: key, asset: audio });
							};
							audio.onerror = () => {
								reject(new Error(`Failed to load audio: ${audios[key]["src"]}`));
							};
							audio.src = audios[key]["src"];
						})
					);
				});
			}
		});

		Promise.all(promises)
			.then((datas) => {
				datas.forEach((data) => {
					assets[data.type][data.name]["asset"] = data.asset;
				});
				console.log("All assets loaded.");
				if (rule && typeof rule === "function") rule();
				requestAnimationFrame(loop);
				console.log("Game start");
			})
			.catch((error) => {
				console.error(error);
			});
	};

  	const addUpdateEvent = (event) => {
		if (typeof event !== "function") throw new Error(`This element must be a function`);
		if (!updates.includes(event)) {
			updates.push(event);
			fireEventListener("addUpdate", event);
		}
	};
	
	const removeUpdateEvent = (event) => {
		if (typeof event !== "function") throw new Error(`This element must be a function`);
		if (updates.includes(event)) {
			updates = updates.filter((update) => update !== event);
			fireEventListener("removeUpdate", event);
		}
	};

	const addRenderEvent = (event) => {
		if (typeof event !== "function") throw new Error(`This element must be a function`);
		if (!renders.includes(event)) {
			renders.push(event);
			fireEventListener("addRender", event);
		}
	};
	
	const removeRenderEvent = (event) => {
		if (typeof event !== "function") throw new Error(`This element must be a function`);
		if (renders.includes(event)) {
			renders = renders.filter((render) => render !== event);
			fireEventListener("removeRender", event);
		}
	};

	const addEventListener = (tp, fn) => {
		if (!events[tp]) events[tp] = [];
		events[tp].push(fn);
	};

	const removeEventListener = (tp, fn) => {
		if (events[tp]) {
			events[tp] = events[tp].filter((listener) => listener !== fn);
		}
	};

	const fireEventListener = (tp, ...args) => {
		if (events[tp]) {
			events[tp].forEach((fn) => fn(...args));
		}
	};

	document.addEventListener("keydown", (e) => {
		pressedKeys[e.key] = true;
	});

	const addPressedKey = (key) => {
		pressedKeys[key] = true;
	};
	
	document.addEventListener("keyup", (e) => {
		delete pressedKeys[e.key];
	});

	const removePressedKey = (key) => {
		delete pressedKeys[key];
	};

	document.addEventListener("visibilitychange", () => {
		if (document.hidden) {
			console.log("document hide");
			lastTime = 0;
		} else {
			console.log("document show");
		}
	});
	
	return {
		start,
		addAsset,
		getAsset,
		getPressedKeys,
		addUpdateEvent,
		removeUpdateEvent,
		addRenderEvent,
		removeRenderEvent,
		addPressedKey,
		removePressedKey,
		addEventListener,
		removeEventListener,
		render: canvas,
	};
};

export { Canvas, Entity, Game };
