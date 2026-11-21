// Exports every WardVoice illustration fragment to a standalone SVG for the design catalogue.
//   cd web && bun run scripts/export-figures.tsx
import { mkdirSync, writeFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";

import { BloodCellsFigure, BoneFigure, CareBadge, DnaHelix, EcgLine, HeartFigure, LungsFigure, StethoscopeFigure } from "../src/wardvoice/figures";

const out = "../docs/design/figures";
mkdirSync(out, { recursive: true });

const figures: Record<string, React.ReactElement> = {
	"dna-helix": <DnaHelix title="DNA helix" />,
	heart: <HeartFigure title="Heart" />,
	lungs: <LungsFigure title="Lungs with focus of care" />,
	bone: <BoneFigure title="Hip bone" />,
	"blood-cells": <BloodCellsFigure title="Red blood cells" />,
	stethoscope: <StethoscopeFigure title="Stethoscope" />,
	"care-badge": <CareBadge title="Care badge" />,
	ecg: <EcgLine color="#0B5FFF" />,
};

for (const [name, el] of Object.entries(figures)) {
	let svg = renderToStaticMarkup(el).replace(/ class="[^"]*"/g, "");
	if (!svg.includes('xmlns="')) svg = svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
	svg = svg.replace("<svg", '<svg width="240"');
	// The helix is white artwork made for the blue splash; give it that backdrop so it shows on white pages.
	if (name === "dna-helix") svg = svg.replace("<defs>", '<rect width="240" height="340" rx="28" fill="#0B5FFF"></rect><defs>');
	writeFileSync(`${out}/${name}.svg`, svg);
	console.log("wrote", name);
}
