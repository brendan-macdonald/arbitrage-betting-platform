"use client";

import React, { useEffect, useRef, useState } from "react";
import { SPORTS } from "@/lib/oddsAdapters/sports";

const ARB_OPTIONS = [
	{ value: "1", label: "True Arbitrage" },
	{ value: "1.01", label: "Near Arbitrage" },
];

const SPORT_DISPLAY_NAMES: Record<string, string> = {
	americanfootball_cfl: "CFL Football",
	americanfootball_ncaaf: "NCAAF Football",
	americanfootball_nfl: "NFL Football",
	aussierules_afl: "Aussie Rules (AFL)",
	baseball_kbo: "KBO Baseball",
	baseball_mlb: "MLB Baseball",
	baseball_npb: "NPB Baseball",
	basketball_nbl: "Basketball (NBL)",
	basketball_wnba: "Basketball (WNBA)",
	boxing_boxing: "Boxing",
	mma_mixed_martial_arts: "MMA",
	cricket_international_t20: "Cricket T20",
	icehockey_liiga: "Ice Hockey (Liiga)",
	icehockey_mestis: "Ice Hockey (Mestis)",
	icehockey_sweden_allsvenskan: "Ice Hockey (Sweden Allsvenskan)",
	icehockey_sweden_hockey_league: "Ice Hockey (Sweden Hockey League)",
	rugbyleague_nrl: "Rugby League (NRL)",
	soccer_argentina_primera_division: "Soccer (Argentina Primera)",
	soccer_austria_bundesliga: "Soccer (Austria Bundesliga)",
	soccer_belgium_first_div: "Soccer (Belgium First Div)",
	soccer_brazil_campeonato: "Soccer (Brazil Campeonato)",
	soccer_brazil_serie_b: "Soccer (Brazil Serie B)",
	soccer_chile_campeonato: "Soccer (Chile Campeonato)",
	soccer_china_superleague: "Soccer (China Superleague)",
	soccer_conmebol_copa_libertadores: "Soccer (Copa Libertadores)",
	soccer_conmebol_copa_sudamericana: "Soccer (Copa Sudamericana)",
	soccer_denmark_superliga: "Soccer (Denmark Superliga)",
	soccer_efl_champ: "Soccer (EFL Champ)",
	soccer_england_efl_cup: "Soccer (England EFL Cup)",
	soccer_england_league1: "Soccer (England League 1)",
	soccer_england_league2: "Soccer (England League 2)",
	soccer_epl: "Soccer (EPL)",
	soccer_fifa_world_cup_qualifiers_europe: "Soccer (World Cup Qualifiers Europe)",
	soccer_finland_veikkausliiga: "Soccer (Finland Veikkausliiga)",
	soccer_france_ligue_one: "Soccer (France Ligue 1)",
	soccer_france_ligue_two: "Soccer (France Ligue 2)",
	soccer_germany_bundesliga: "Soccer (Germany Bundesliga)",
	soccer_germany_bundesliga2: "Soccer (Germany Bundesliga 2)",
	soccer_germany_liga3: "Soccer (Germany Liga 3)",
	soccer_greece_super_league: "Soccer (Greece Super League)",
	soccer_italy_serie_a: "Soccer (Italy Serie A)",
	soccer_italy_serie_b: "Soccer (Italy Serie B)",
	soccer_japan_j_league: "Soccer (Japan J League)",
	soccer_korea_kleague1: "Soccer (Korea K League 1)",
	soccer_league_of_ireland: "Soccer (League of Ireland)",
	soccer_mexico_ligamx: "Soccer (Mexico Liga MX)",
	soccer_netherlands_eredivisie: "Soccer (Netherlands Eredivisie)",
	soccer_norway_eliteserien: "Soccer (Norway Eliteserien)",
	soccer_poland_ekstraklasa: "Soccer (Poland Ekstraklasa)",
	soccer_portugal_primeira_liga: "Soccer (Portugal Primeira Liga)",
	soccer_spain_la_liga: "Soccer (Spain La Liga)",
	soccer_spain_segunda_division: "Soccer (Spain Segunda Division)",
	soccer_spl: "Soccer (SPL)",
	soccer_sweden_allsvenskan: "Soccer (Sweden Allsvenskan)",
	soccer_sweden_superettan: "Soccer (Sweden Superettan)",
	soccer_switzerland_superleague: "Soccer (Switzerland Superleague)",
	soccer_turkey_super_league: "Soccer (Turkey Super League)",
	soccer_uefa_champs_league: "Soccer (UEFA Champions League)",
	soccer_uefa_europa_league: "Soccer (UEFA Europa League)",
	soccer_usa_mls: "Soccer (USA MLS)",
	tennis_wta_china_open: "Tennis (WTA China Open)",
};

const MARKET_OPTIONS = [
	{ value: "h2h", label: "Moneyline (H2H)" },
];

function loadPrefs() {
	return {
		sports: JSON.parse(localStorage.getItem("prefs.sports") || "[]"),
		markets: JSON.parse(localStorage.getItem("prefs.markets") || "[\"h2h\"]"),
		minRoi: Number(localStorage.getItem("prefs.minRoi") || 1.0),
	};
}
function savePrefs({ sports, markets, minRoi }: { sports: string[]; markets: string[]; minRoi: number }) {
	localStorage.setItem("prefs.sports", JSON.stringify(sports));
	localStorage.setItem("prefs.markets", JSON.stringify(markets));
	localStorage.setItem("prefs.minRoi", String(minRoi));
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
	const allSelected = values.length === options.length;
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

export default function Filters({ onChange }: { onChange?: (v: { sports: string[]; markets: string[]; minRoi: number }) => void } = {}) {
	const [sports, setSportsState] = useState<string[]>([]);
	const [markets, setMarketsState] = useState<string[]>(["h2h"]);
	const [minRoi, setMinRoiState] = useState(1.0);

	useEffect(() => {
		const prefs = loadPrefs();
		setSportsState(prefs.sports);
		setMarketsState(prefs.markets);
		setMinRoiState(prefs.minRoi);
	}, []);

	// Call onChange only when user changes a filter
	function setSports(s: string[]) {
		setSportsState(s);
		savePrefs({ sports: s, markets, minRoi });
		onChange?.({ sports: s, markets, minRoi });
	}
	function setMarkets(m: string[]) {
		setMarketsState(m);
		savePrefs({ sports, markets: m, minRoi });
		onChange?.({ sports, markets: m, minRoi });
	}
	function setMinRoiValue(r: number) {
		setMinRoiState(r);
		savePrefs({ sports, markets, minRoi: r });
		onChange?.({ sports, markets, minRoi: r });
	}

	return (
		<div className="flex flex-wrap items-center gap-4 p-2 bg-white/70 rounded-xl shadow-sm">
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
