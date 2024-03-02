import { ASSET_TYPE_IMAGE, ASSET_TYPE_AUDIO, ASSET_TYPE_VIDEO } from "./Config";
import { Canvas } from "./Canvas";

export const Game = (canvasId, width, height) => {
	
	const canvas = Canvas(canvasId);
	const ctx = canvas.ctx;
	canvas.resize(width, height);

	const assets = {
		[ASSET_TYPE_IMAGE]: {},
		[ASSET_TYPE_AUDIO]: {},
		[ASSET_TYPE_VIDEO]: {},
	};

	let id = null;
	let lastTime = 0;
	let pressedKeys = {};
	let updates = [];
	let renders = [];
	let events = {};

	const loop = (timestamp) => {
		if (lastTime === 0) lastTime = timestamp;
		const deltaTime = timestamp - lastTime;
		// console.log(deltaTime);
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
							}
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
				id = requestAnimationFrame(loop);
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
	}

	const removeEventListener = (tp, fn) => {
		if (events[tp]) {
			events[tp] = events[tp].filter((listener) => listener !== fn);
		}
	}

	const fireEventListener = (tp, ...args) => {
		if (events[tp]) {
			events[tp].forEach((fn) => fn(...args));
		}
	}

	document.addEventListener("keydown", (e) => {
		pressedKeys[e.key] = true;
	});

	const addPressedKey = (key) => {
		pressedKeys[key] = true;
	}
	
	document.addEventListener("keyup", (e) => {
		delete pressedKeys[e.key];
	});

	const removePressedKey = (key) => {
		delete pressedKeys[key];
	}

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
	};
};
