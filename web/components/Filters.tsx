"use client";

import React, { useEffect, useRef, useState } from "react";
import { SPORTS, SPORT_DISPLAY_NAMES } from "@/lib/oddsAdapters/sports";


const MARKET_OPTIONS = [
	{ value: "h2h", label: "Moneyline (H2H)" },
];

function loadPrefs() {
		return {
			sports: JSON.parse(localStorage.getItem("prefs.sports") || "[]"),
			markets: JSON.parse(localStorage.getItem("prefs.markets") || "[\"h2h\"]"),
			minRoi: Number(localStorage.getItem("prefs.minRoi") || 1.0),
			bookmakers: JSON.parse(localStorage.getItem("prefs.bookmakers") || "[]"),
		};
}
function savePrefs({ sports, markets, minRoi, bookmakers }: { sports: string[]; markets: string[]; minRoi: number; bookmakers?: string[] }) {
	localStorage.setItem("prefs.sports", JSON.stringify(sports));
	localStorage.setItem("prefs.markets", JSON.stringify(markets));
	localStorage.setItem("prefs.minRoi", String(minRoi));
	if (bookmakers) {
		localStorage.setItem("prefs.bookmakers", JSON.stringify(bookmakers));
	}
}

function ROISlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
	return (
		<label className="flex items-center gap-2 text-xs">
			ROI ≥ <span className="font-semibold">{value.toFixed(1)}%</span>
			<input
				type="range"
				min={0.5}
				max={5.0}
				step={0.1}
				value={value}
				onChange={e => onChange(Number(e.target.value))}
				className="accent-blue-500 w-28"
			/>
		</label>
	);
}

function SportsDropdown({ options, values, onChange }: { options: { value: string; label: string }[]; values: string[]; onChange: (v: string[]) => void }) {
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState("");
	const ref = useRef<HTMLDivElement>(null);
	useEffect(() => {
		function handleClick(e: MouseEvent) {
			if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
		}
		if (open) document.addEventListener("mousedown", handleClick);
		return () => document.removeEventListener("mousedown", handleClick);
	}, [open]);
	const filtered = options.filter(opt => opt.label.toLowerCase().includes(search.toLowerCase()));
	return (
		<div className="relative" ref={ref}>
			<button type="button" onClick={() => setOpen(v => !v)} className="px-3 py-1.5 rounded-lg border bg-white shadow-sm text-sm flex items-center gap-2 min-w-[180px]">
				{values.length ? `${values.length} selected` : "Select sports"}
				<svg className="w-4 h-4 ml-1" viewBox="0 0 20 20"><path d="M7 7l3-3 3 3m0 6l-3 3-3-3" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>
			</button>
			{open && (
				<div className="absolute z-10 mt-2 w-72 max-h-80 overflow-auto rounded-xl border bg-white shadow-lg p-3">
					<input
						type="text"
						placeholder="Search sports..."
						value={search}
						onChange={e => setSearch(e.target.value)}
						className="w-full mb-2 px-2 py-1 rounded border text-sm"
					/>
					<div className="flex items-center mb-2 gap-2">
						<button type="button" className="text-xs underline" onClick={() => onChange(options.map(o => o.value))}>Select All</button>
						<button type="button" className="text-xs underline" onClick={() => onChange([])}>Clear</button>
					</div>
					<div className="grid grid-cols-1 gap-1">
						{filtered.map(opt => (
							<label key={opt.value} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-blue-50 cursor-pointer">
								<input
									type="checkbox"
									checked={values.includes(opt.value)}
									onChange={e => {
										if (e.target.checked) onChange([...values, opt.value]);
										else onChange(values.filter(v => v !== opt.value));
									}}
									className="accent-blue-500"
								/>
								<span className="text-sm">{opt.label}</span>
							</label>
						))}
					</div>
				</div>
			)}
		</div>
	);
}

function MultiSelect({ options, values, onChange }: { options: { value: string; label: string }[]; values: string[]; onChange: (v: string[]) => void }) {
	return (
		<div className="flex flex-wrap gap-1">
			{options.map(opt => (
				<label key={opt.value} className={`px-2 py-1 rounded-full border text-xs cursor-pointer ${values.includes(opt.value) ? "bg-blue-100 border-blue-400 text-blue-700" : "bg-white border-gray-300"}`}>
					<input
						type="checkbox"
						checked={values.includes(opt.value)}
						onChange={e => {
							if (e.target.checked) onChange([...values, opt.value]);
							else onChange(values.filter(v => v !== opt.value));
						}}
						className="mr-1 accent-blue-500"
					/>
					{opt.label}
				</label>
			))}
		</div>
	);
}

export default function Filters({ onChange }: { onChange?: (v: { sports: string[]; markets: string[]; minRoi: number; bookmakers: string[] }) => void } = {}) {
		const [bookmakerOptions, setBookmakerOptions] = useState<string[]>([]);
		useEffect(() => {
			fetch("/api/opportunities?freshMins=10080")
				.then(res => res.ok ? res.json() : null)
				.then(data => {
					if (data?.bookmakers) setBookmakerOptions(data.bookmakers);
				});
		}, []);
			const [sports, setSportsState] = useState<string[]>([]);
			const [markets, setMarketsState] = useState<string[]>(["h2h"]);
			const [minRoi, setMinRoiState] = useState(0.0);
			const [bookmakers, setBookmakersState] = useState<string[]>([]);

	useEffect(() => {
		const prefs = loadPrefs();
		setSportsState(prefs.sports);
		setMarketsState(prefs.markets);
		setMinRoiState(prefs.minRoi);
		setBookmakersState(prefs.bookmakers);
	}, []);

	// Call onChange only when user changes a filter
		function setSports(s: string[]) {
			setSportsState(s);
			savePrefs({ sports: s, markets, minRoi, bookmakers });
			onChange?.({ sports: s, markets, minRoi, bookmakers });
		}
		function setMarkets(m: string[]) {
			setMarketsState(m);
			savePrefs({ sports, markets: m, minRoi, bookmakers });
			onChange?.({ sports, markets: m, minRoi, bookmakers });
		}
		function setMinRoiValue(r: number) {
			setMinRoiState(r);
			savePrefs({ sports, markets, minRoi: r, bookmakers });
			onChange?.({ sports, markets, minRoi: r, bookmakers });
		}
		function setBookmakers(b: string[]) {
			setBookmakersState(b);
			savePrefs({ sports, markets, minRoi, bookmakers: b });
			onChange?.({ sports, markets, minRoi, bookmakers: b });
		}
			function BookmakersDropdown({ options, values, onChange }: { options: string[]; values: string[]; onChange: (v: string[]) => void }) {
				const [open, setOpen] = useState(false);
				const [search, setSearch] = useState("");
				const ref = useRef<HTMLDivElement>(null);
				useEffect(() => {
					function handleClick(e: MouseEvent) {
						if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
					}
					if (open) document.addEventListener("mousedown", handleClick);
					return () => document.removeEventListener("mousedown", handleClick);
				}, [open]);
				const filtered = options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()));
				return (
					<div className="relative" ref={ref}>
						<button type="button" onClick={() => setOpen(v => !v)} className="px-3 py-1.5 rounded-lg border bg-white shadow-sm text-sm flex items-center gap-2 min-w-[180px]">
							{values.length ? `${values.length} selected` : "Select bookmakers"}
							<svg className="w-4 h-4 ml-1" viewBox="0 0 20 20"><path d="M7 7l3-3 3 3m0 6l-3 3-3-3" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>
						</button>
						{open && (
							<div className="absolute z-10 mt-2 w-72 max-h-80 overflow-auto rounded-xl border bg-white shadow-lg p-3">
								<input
									type="text"
									placeholder="Search bookmakers..."
									value={search}
									onChange={e => setSearch(e.target.value)}
									className="w-full mb-2 px-2 py-1 rounded border text-sm"
								/>
								<div className="flex items-center mb-2 gap-2">
									<button type="button" className="text-xs underline" onClick={() => onChange(options)}>Select All</button>
									<button type="button" className="text-xs underline" onClick={() => onChange([])}>Clear</button>
								</div>
								<div className="grid grid-cols-1 gap-1">
									{filtered.map(opt => (
										<label key={opt} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-blue-50 cursor-pointer">
											<input
												type="checkbox"
												checked={values.includes(opt)}
												onChange={e => {
													if (e.target.checked) onChange([...values, opt]);
													else onChange(values.filter(v => v !== opt));
												}}
												className="accent-blue-500"
											/>
											<span className="text-sm">{opt}</span>
										</label>
									))}
								</div>
							</div>
						)}
					</div>
				);
			}

		return (
			<div className="flex flex-wrap items-center gap-4 p-2 bg-white/70 rounded-xl shadow-sm">
				<div>
					<span className="text-xs text-muted-foreground mr-2">Bookmakers</span>
					<BookmakersDropdown options={bookmakerOptions} values={bookmakers} onChange={setBookmakers} />
				</div>
				<div>
					<span className="text-xs text-muted-foreground mr-2">Sports</span>
					<SportsDropdown
						options={SPORTS.map(s => ({ value: s, label: SPORT_DISPLAY_NAMES[s] || s }))}
						values={sports}
						onChange={setSports}
					/>
				</div>
				<div>
					<span className="text-xs text-muted-foreground mr-2">Markets</span>
					<MultiSelect
						options={MARKET_OPTIONS}
						values={markets}
						onChange={setMarkets}
					/>
				</div>
				<ROISlider value={minRoi} onChange={setMinRoiValue} />
			</div>
		);
}
