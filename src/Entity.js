export class Entity {
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
