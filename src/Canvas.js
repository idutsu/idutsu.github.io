import { Entity } from "./Entity";

export const Canvas = (canvasId) => {
	const canvas = document.getElementById(canvasId);
	const ctx = canvas.getContext("2d");

	const clear = () => {
		ctx.clearRect(0, 0, canvas.width, canvas.height);
	};

	const image = (image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight) => {
		ctx.drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);	
	}

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
