// ==UserScript==
// @name         Evolve tooltips
// @namespace    http://tampermonkey.net/
// @description  try to take over the world!
// @author       Elias
// @version      1.0.1
// @downloadURL  https://github.com/elias098/evolve-tooltips/raw/main/main.user.js
// @match        https://pmotschmann.github.io/Evolve/
// @grant        none
// ==/UserScript==

(function() {
  'use strict';

  class Technology {
    constructor(id) {
      this._id = id;
      this._vueBinding = "tech-" + id;
    }
  
    get id() {
      return this._id;
    }
  
    isUnlocked() {
      // vue of researched techs still can be found in #oldTech
      return (
        document.querySelector("#" + this._vueBinding + " > a") !== null &&
        getVueById(this._vueBinding) !== undefined
      );
    }
  
    get definition() {
      return game.actions.tech[this._id];
    }
  
    get title() {
      return typeof this.definition.title === "function"
        ? this.definition.title()
        : this.definition.title;
    }
  
    get name() {
      return this.title;
    }
  
    isResearched() {
      return document.querySelector("#tech-" + this.id + " .oldTech") !== null;
    }
  }
  
  class Action {
    constructor(name, tab, id, location, flags) {
      this.name = name;
      this._tab = tab;
      this._id = id;
      this._location = location;
      this.gameMax = Number.MAX_SAFE_INTEGER;
  
      this._vueBinding = this._tab + "-" + this.id;
    }
  
    get definition() {
      if (this._location !== "") {
        return game.actions[this._tab][this._location][this._id];
      } else {
        return game.actions[this._tab][this._id];
      }
    }
  
    get instance() {
      return game.global[this._tab][this._id];
    }
  
    get id() {
      return this._id;
    }
  
    get title() {
      let def = this.definition;
      return def
        ? typeof def.title === "function"
          ? def.title()
          : def.title
        : this.name;
    }
  
    get desc() {
      let def = this.definition;
      return def
        ? typeof def.desc === "function"
          ? def.desc()
          : def.desc
        : this.name;
    }
  
    get vue() {
      return getVueById(this._vueBinding);
    }
  
    isUnlocked() {
      return document.getElementById(this._vueBinding) !== null;
    }
  
    isSwitchable() {
      return (
        this.definition.hasOwnProperty("powered") ||
        this.definition.hasOwnProperty("switchable")
      );
    }
  
    isMission() {
      return this.definition.hasOwnProperty("grant");
    }
  
    isComplete() {
      return haveTech(this.definition.grant[0], this.definition.grant[1]);
    }
  
    // export function checkPowerRequirements(c_action) from actions.js
    checkPowerRequirements(def) {
      for (let [tech, value] of Object.entries(
        this.definition.power_reqs ?? {}
      )) {
        if (!haveTech(tech, value)) {
          return false;
        }
      }
      return true;
    }
  
    get powered() {
      if (this.overridePowered !== undefined) {
        return this.overridePowered;
      }
  
      if (
        !this.definition.hasOwnProperty("powered") ||
        !this.checkPowerRequirements()
      ) {
        return 0;
      }
  
      return this.definition.powered();
    }
  
    get count() {
      if (!this.isUnlocked()) {
        return 0;
      }
  
      return this.instance?.count ?? 0;
    }
  
    hasState() {
      if (!this.isUnlocked()) {
        return false;
      }
  
      return (
        (this.definition.powered &&
          haveTech("high_tech", 2) &&
          this.checkPowerRequirements()) ||
        this.definition.switchable?.() ||
        false
      );
    }
  
    get stateOnCount() {
      if (!this.hasState() || this.count < 1) {
        return 0;
      }
  
      return this.instance.on;
    }
  
    get stateOffCount() {
      if (!this.hasState() || this.count < 1) {
        return 0;
      }
  
      return this.instance.count - this.instance.on;
    }
  }
  
  class Project extends Action {
    constructor(name, id) {
      super(name, "arpa", id, "");
      this._vueBinding = "arpa" + this.id;
      this.currentStep = 1;
    }
  
    get count() {
      return this.instance?.rank ?? 0;
    }
  
    get progress() {
      return this.instance?.complete ?? 0;
    }
  }

  class Job {
    constructor(id, name) {
        // Private properties
        this._originalId = id;
        this._originalName = name;
        this._vueBinding = "civ-" + this._originalId;
    }

    get definition() {
        return game.global.civic[this._originalId];
    }

    get id() {
        return this.definition.job;
    }

    get name() {
        return this.definition.name;
    }

    isUnlocked() {
        return this.definition.display;
    }

    get count() {
        return this.definition.workers;
    }

    get max() {
        if (this.definition.max === -1) {
            return Number.MAX_SAFE_INTEGER;
        }

        return this.definition.max;
    }

    isDefault() {
        return game.global.civic.d_job === this.id;
    }
}
  
  let buildings = {
    Food: new Action("Food", "city", "food", ""),
    Lumber: new Action("Lumber", "city", "lumber", ""),
    Stone: new Action("Stone", "city", "stone", ""),
    Chrysotile: new Action("Chrysotile", "city", "chrysotile", ""),
    Slaughter: new Action("Slaughter", "city", "slaughter", ""),
    ForgeHorseshoe: new Action("Horseshoe", "city", "horseshoe", "", {
      housing: true,
      garrison: true,
    }),
    SacrificialAltar: new Action("Sacrificial Altar", "city", "s_alter", ""),
    MeditationChamber: new Action("Meditation Chamber", "city", "meditation", ""),
  
    University: new Action("University", "city", "university", "", {
      knowledge: true,
    }),
    Wardenclyffe: new Action("Wardenclyffe", "city", "wardenclyffe", "", {
      knowledge: true,
    }),
    Mine: new Action("Mine", "city", "mine", "", { smart: true }),
    CoalMine: new Action("Coal Mine", "city", "coal_mine", "", { smart: true }),
    Smelter: new Action("Smelter", "city", "smelter", ""),
    CoalPower: new Action("Coal Powerplant", "city", "coal_power", ""),
    Temple: new Action("Temple", "city", "temple", ""),
    OilWell: new Action("Oil Derrick", "city", "oil_well", ""),
    BioLab: new Action("Bioscience Lab", "city", "biolab", "", {
      knowledge: true,
    }),
    StorageYard: new Action("Freight Yard", "city", "storage_yard", ""),
    Warehouse: new Action("Container Port", "city", "warehouse", ""),
    OilPower: new Action("Oil Powerplant", "city", "oil_power", ""),
    Bank: new Action("Bank", "city", "bank", ""),
    Barracks: new Action("Barracks", "city", "garrison", "", {
      garrison: true,
      smart: true,
    }),
    Hospital: new Action("Hospital", "city", "hospital", ""),
    BootCamp: new Action("Boot Camp", "city", "boot_camp", ""),
    House: new Action("Cabin", "city", "basic_housing", "", { housing: true }),
    Cottage: new Action("Cottage", "city", "cottage", "", { housing: true }),
    Apartment: new Action("Apartment", "city", "apartment", "", {
      housing: true,
    }),
    Farm: new Action("Farm", "city", "farm", "", { housing: true }),
    SoulWell: new Action("Soul Well", "city", "soul_well", ""),
    Mill: new Action("Windmill", "city", "mill", "", { smart: true }),
    Windmill: new Action("Windmill (Evil)", "city", "windmill", ""),
    Silo: new Action("Grain Silo", "city", "silo", ""),
    Shed: new Action("Shed", "city", "shed", ""),
    LumberYard: new Action("Lumber Yard", "city", "lumber_yard", ""),
    RockQuarry: new Action("Rock Quarry", "city", "rock_quarry", ""),
    CementPlant: new Action("Cement Plant", "city", "cement_plant", "", {
      smart: true,
    }),
    Foundry: new Action("Foundry", "city", "foundry", ""),
    Factory: new Action("Factory", "city", "factory", ""),
    OilDepot: new Action("Fuel Depot", "city", "oil_depot", ""),
    Trade: new Action("Trade Post", "city", "trade", ""),
    Amphitheatre: new Action("Amphitheatre", "city", "amphitheatre", ""),
    Library: new Action("Library", "city", "library", "", { knowledge: true }),
    Sawmill: new Action("Sawmill", "city", "sawmill", ""),
    FissionPower: new Action("Fission Reactor", "city", "fission_power", ""),
    Lodge: new Action("Lodge", "city", "lodge", "", { housing: true }),
    Smokehouse: new Action("Smokehouse", "city", "smokehouse", ""),
    Casino: new Action("Casino", "city", "casino", ""),
    TouristCenter: new Action("Tourist Center", "city", "tourist_center", "", {
      smart: true,
    }),
    MassDriver: new Action("Mass Driver", "city", "mass_driver", "", {
      knowledge: () => haveTech("mass", 2),
    }),
    Wharf: new Action("Wharf", "city", "wharf", ""),
    MetalRefinery: new Action("Metal Refinery", "city", "metal_refinery", ""),
    SlavePen: new Action("Slave Pen", "city", "slave_pen", ""),
    SlaveMarket: new Action("Slave Market", "city", "slave_market", ""),
    Graveyard: new Action("Graveyard", "city", "graveyard", ""),
    Shrine: new Action("Shrine", "city", "shrine", ""),
    CompostHeap: new Action("Compost Heap", "city", "compost", ""),
    Pylon: new Action("Pylon", "city", "pylon", ""),
  
    SpaceTestLaunch: new Action(
      "Space Test Launch",
      "space",
      "test_launch",
      "spc_home"
    ),
    SpaceSatellite: new Action(
      "Space Satellite",
      "space",
      "satellite",
      "spc_home",
      { knowledge: true }
    ),
    SpaceGps: new Action("Space Gps", "space", "gps", "spc_home"),
    SpacePropellantDepot: new Action(
      "Space Propellant Depot",
      "space",
      "propellant_depot",
      "spc_home"
    ),
    SpaceNavBeacon: new Action(
      "Space Navigation Beacon",
      "space",
      "nav_beacon",
      "spc_home"
    ),
  
    MoonMission: new Action("Moon Mission", "space", "moon_mission", "spc_moon"),
    MoonBase: new Action("Moon Base", "space", "moon_base", "spc_moon"),
    MoonIridiumMine: new Action(
      "Moon Iridium Mine",
      "space",
      "iridium_mine",
      "spc_moon"
    ),
    MoonHeliumMine: new Action(
      "Moon Helium-3 Mine",
      "space",
      "helium_mine",
      "spc_moon"
    ),
    MoonObservatory: new Action(
      "Moon Observatory",
      "space",
      "observatory",
      "spc_moon",
      { knowledge: true }
    ),
  
    RedMission: new Action("Red Mission", "space", "red_mission", "spc_red"),
    RedSpaceport: new Action("Red Spaceport", "space", "spaceport", "spc_red"),
    RedTower: new Action("Red Space Control", "space", "red_tower", "spc_red"),
    RedLivingQuarters: new Action(
      "Red Living Quarters",
      "space",
      "living_quarters",
      "spc_red",
      { housing: true }
    ),
    RedVrCenter: new Action("Red VR Center", "space", "vr_center", "spc_red"),
    RedGarage: new Action("Red Garage", "space", "garage", "spc_red"),
    RedMine: new Action("Red Mine", "space", "red_mine", "spc_red"),
    RedFabrication: new Action(
      "Red Fabrication",
      "space",
      "fabrication",
      "spc_red"
    ),
    RedFactory: new Action("Red Factory", "space", "red_factory", "spc_red"),
    RedBiodome: new Action("Red Biodome", "space", "biodome", "spc_red"),
    RedExoticLab: new Action(
      "Red Exotic Materials Lab",
      "space",
      "exotic_lab",
      "spc_red",
      { knowledge: true }
    ),
    RedZiggurat: new Action("Red Ziggurat", "space", "ziggurat", "spc_red"),
    RedSpaceBarracks: new Action(
      "Red Marine Barracks",
      "space",
      "space_barracks",
      "spc_red",
      { garrison: true }
    ),
    RedForgeHorseshoe: new Action(
      "Red Horseshoe (Cataclysm)",
      "space",
      "horseshoe",
      "spc_red",
      { housing: true, garrison: true }
    ),
  
    HellMission: new Action("Hell Mission", "space", "hell_mission", "spc_hell"),
    HellGeothermal: new Action(
      "Hell Geothermal Plant",
      "space",
      "geothermal",
      "spc_hell"
    ),
    HellSpaceCasino: new Action(
      "Hell Space Casino",
      "space",
      "spc_casino",
      "spc_hell"
    ),
    HellSwarmPlant: new Action(
      "Hell Swarm Plant",
      "space",
      "swarm_plant",
      "spc_hell"
    ),
  
    SunMission: new Action("Sun Mission", "space", "sun_mission", "spc_sun"),
    SunSwarmControl: new Action(
      "Sun Control Station",
      "space",
      "swarm_control",
      "spc_sun"
    ),
    SunSwarmSatellite: new Action(
      "Sun Swarm Satellite",
      "space",
      "swarm_satellite",
      "spc_sun"
    ),
  
    GasMission: new Action("Gas Mission", "space", "gas_mission", "spc_gas"),
    GasMining: new Action(
      "Gas Helium-3 Collector",
      "space",
      "gas_mining",
      "spc_gas",
      { smart: true }
    ),
    GasStorage: new Action("Gas Fuel Depot", "space", "gas_storage", "spc_gas"),
  
    GasMoonMission: new Action(
      "Gas Moon Mission",
      "space",
      "gas_moon_mission",
      "spc_gas_moon"
    ),
    GasMoonOutpost: new Action(
      "Gas Moon Mining Outpost",
      "space",
      "outpost",
      "spc_gas_moon"
    ),
    GasMoonDrone: new Action(
      "Gas Moon Mining Drone",
      "space",
      "drone",
      "spc_gas_moon"
    ),
    GasMoonOilExtractor: new Action(
      "Gas Moon Oil Extractor",
      "space",
      "oil_extractor",
      "spc_gas_moon",
      { smart: true }
    ),
  
    BeltMission: new Action("Belt Mission", "space", "belt_mission", "spc_belt"),
    BeltSpaceStation: new Action(
      "Belt Space Station",
      "space",
      "space_station",
      "spc_belt",
      { smart: true }
    ),
    BeltEleriumShip: new Action(
      "Belt Elerium Mining Ship",
      "space",
      "elerium_ship",
      "spc_belt",
      { smart: true }
    ),
    BeltIridiumShip: new Action(
      "Belt Iridium Mining Ship",
      "space",
      "iridium_ship",
      "spc_belt",
      { smart: true }
    ),
    BeltIronShip: new Action(
      "Belt Iron Mining Ship",
      "space",
      "iron_ship",
      "spc_belt",
      { smart: true }
    ),
  
    DwarfMission: new Action(
      "Dwarf Mission",
      "space",
      "dwarf_mission",
      "spc_dwarf"
    ),
    DwarfEleriumContainer: new Action(
      "Dwarf Elerium Storage",
      "space",
      "elerium_contain",
      "spc_dwarf",
      { smart: true }
    ),
    DwarfEleriumReactor: new Action(
      "Dwarf Elerium Reactor",
      "space",
      "e_reactor",
      "spc_dwarf"
    ),
    DwarfWorldCollider: new Action(
      "Dwarf World Collider",
      "space",
      "world_collider",
      "spc_dwarf"
    ),
    DwarfWorldController: new Action(
      "Dwarf World Collider (Complete)",
      "space",
      "world_controller",
      "spc_dwarf",
      { knowledge: true }
    ),
  
    /*
          DwarfShipyard: new Action("Dwarf Ship Yard", "space", "shipyard", "spc_dwarf"),
          TitanMission: new Action("Titan Mission", "space", "titan_mission", "spc_titan"),
          TitanSpaceport: new Action("Titan Spaceport", "space", "titan_spaceport", "spc_titan"),
          EnceladusMission: new Action("Enceladus Mission", "space", "enceladus_mission", "spc_enceladus"),
          */
  
    AlphaMission: new Action(
      "Alpha Centauri Mission",
      "interstellar",
      "alpha_mission",
      "int_alpha"
    ),
    AlphaStarport: new Action(
      "Alpha Starport",
      "interstellar",
      "starport",
      "int_alpha"
    ),
    AlphaHabitat: new Action(
      "Alpha Habitat",
      "interstellar",
      "habitat",
      "int_alpha",
      { housing: true }
    ),
    AlphaMiningDroid: new Action(
      "Alpha Mining Droid",
      "interstellar",
      "mining_droid",
      "int_alpha"
    ),
    AlphaProcessing: new Action(
      "Alpha Processing Facility",
      "interstellar",
      "processing",
      "int_alpha"
    ),
    AlphaFusion: new Action(
      "Alpha Fusion Reactor",
      "interstellar",
      "fusion",
      "int_alpha"
    ),
    AlphaLaboratory: new Action(
      "Alpha Laboratory",
      "interstellar",
      "laboratory",
      "int_alpha",
      { knowledge: true }
    ),
    AlphaExchange: new Action(
      "Alpha Exchange",
      "interstellar",
      "exchange",
      "int_alpha"
    ),
    AlphaGraphenePlant: new Action(
      "Alpha Graphene Plant",
      "interstellar",
      "g_factory",
      "int_alpha"
    ),
    AlphaWarehouse: new Action(
      "Alpha Warehouse",
      "interstellar",
      "warehouse",
      "int_alpha"
    ),
    AlphaMegaFactory: new Action(
      "Alpha Mega Factory",
      "interstellar",
      "int_factory",
      "int_alpha"
    ),
    AlphaLuxuryCondo: new Action(
      "Alpha Luxury Condo",
      "interstellar",
      "luxury_condo",
      "int_alpha",
      { housing: true }
    ),
    AlphaExoticZoo: new Action(
      "Alpha Exotic Zoo",
      "interstellar",
      "zoo",
      "int_alpha"
    ),
  
    ProximaMission: new Action(
      "Proxima Mission",
      "interstellar",
      "proxima_mission",
      "int_proxima"
    ),
    ProximaTransferStation: new Action(
      "Proxima Transfer Station",
      "interstellar",
      "xfer_station",
      "int_proxima"
    ),
    ProximaCargoYard: new Action(
      "Proxima Cargo Yard",
      "interstellar",
      "cargo_yard",
      "int_proxima"
    ),
    ProximaCruiser: new Action(
      "Proxima Patrol Cruiser",
      "interstellar",
      "cruiser",
      "int_proxima",
      { garrison: true }
    ),
    ProximaDyson: new Action(
      "Proxima Dyson Sphere (Adamantite)",
      "interstellar",
      "dyson",
      "int_proxima"
    ),
    ProximaDysonSphere: new Action(
      "Proxima Dyson Sphere (Bolognium)",
      "interstellar",
      "dyson_sphere",
      "int_proxima"
    ),
    ProximaOrichalcumSphere: new Action(
      "Proxima Dyson Sphere (Orichalcum)",
      "interstellar",
      "orichalcum_sphere",
      "int_proxima"
    ),
  
    NebulaMission: new Action(
      "Nebula Mission",
      "interstellar",
      "nebula_mission",
      "int_nebula"
    ),
    NebulaNexus: new Action(
      "Nebula Nexus",
      "interstellar",
      "nexus",
      "int_nebula"
    ),
    NebulaHarvestor: new Action(
      "Nebula Harvester",
      "interstellar",
      "harvester",
      "int_nebula"
    ),
    NebulaEleriumProspector: new Action(
      "Nebula Elerium Prospector",
      "interstellar",
      "elerium_prospector",
      "int_nebula"
    ),
  
    NeutronMission: new Action(
      "Neutron Mission",
      "interstellar",
      "neutron_mission",
      "int_neutron"
    ),
    NeutronMiner: new Action(
      "Neutron Miner",
      "interstellar",
      "neutron_miner",
      "int_neutron"
    ),
    NeutronCitadel: new Action(
      "Neutron Citadel Station",
      "interstellar",
      "citadel",
      "int_neutron"
    ),
    NeutronStellarForge: new Action(
      "Neutron Stellar Forge",
      "interstellar",
      "stellar_forge",
      "int_neutron"
    ),
  
    Blackhole: new Action(
      "Blackhole Mission",
      "interstellar",
      "blackhole_mission",
      "int_blackhole"
    ),
    BlackholeFarReach: new Action(
      "Blackhole Farpoint",
      "interstellar",
      "far_reach",
      "int_blackhole",
      { knowledge: true }
    ),
    BlackholeStellarEngine: new Action(
      "Blackhole Stellar Engine",
      "interstellar",
      "stellar_engine",
      "int_blackhole"
    ),
    BlackholeMassEjector: new Action(
      "Blackhole Mass Ejector",
      "interstellar",
      "mass_ejector",
      "int_blackhole"
    ),
  
    BlackholeJumpShip: new Action(
      "Blackhole Jump Ship",
      "interstellar",
      "jump_ship",
      "int_blackhole"
    ),
    BlackholeWormholeMission: new Action(
      "Blackhole Wormhole Mission",
      "interstellar",
      "wormhole_mission",
      "int_blackhole"
    ),
    BlackholeStargate: new Action(
      "Blackhole Stargate",
      "interstellar",
      "stargate",
      "int_blackhole"
    ),
    BlackholeStargateComplete: new Action(
      "Blackhole Stargate (Complete)",
      "interstellar",
      "s_gate",
      "int_blackhole"
    ),
  
    SiriusMission: new Action(
      "Sirius Mission",
      "interstellar",
      "sirius_mission",
      "int_sirius"
    ),
    SiriusAnalysis: new Action(
      "Sirius B Analysis",
      "interstellar",
      "sirius_b",
      "int_sirius"
    ),
    SiriusSpaceElevator: new Action(
      "Sirius Space Elevator",
      "interstellar",
      "space_elevator",
      "int_sirius"
    ),
    SiriusGravityDome: new Action(
      "Sirius Gravity Dome",
      "interstellar",
      "gravity_dome",
      "int_sirius"
    ),
    SiriusAscensionMachine: new Action(
      "Sirius Ascension Machine",
      "interstellar",
      "ascension_machine",
      "int_sirius"
    ),
    SiriusAscensionTrigger: new Action(
      "Sirius Ascension Machine (Complete)",
      "interstellar",
      "ascension_trigger",
      "int_sirius",
      { smart: true }
    ),
    SiriusAscend: new Action(
      "Sirius Ascend",
      "interstellar",
      "ascend",
      "int_sirius"
    ),
    SiriusThermalCollector: new Action(
      "Sirius Thermal Collector",
      "interstellar",
      "thermal_collector",
      "int_sirius"
    ),
  
    GatewayMission: new Action(
      "Gateway Mission",
      "galaxy",
      "gateway_mission",
      "gxy_gateway"
    ),
    GatewayStarbase: new Action(
      "Gateway Starbase",
      "galaxy",
      "starbase",
      "gxy_gateway",
      { garrison: true }
    ),
    GatewayShipDock: new Action(
      "Gateway Ship Dock",
      "galaxy",
      "ship_dock",
      "gxy_gateway"
    ),
  
    BologniumShip: new Action(
      "Gateway Bolognium Ship",
      "galaxy",
      "bolognium_ship",
      "gxy_gateway",
      { ship: true, smart: true }
    ),
    ScoutShip: new Action(
      "Gateway Scout Ship",
      "galaxy",
      "scout_ship",
      "gxy_gateway",
      { ship: true, smart: true }
    ),
    CorvetteShip: new Action(
      "Gateway Corvette Ship",
      "galaxy",
      "corvette_ship",
      "gxy_gateway",
      { ship: true, smart: true }
    ),
    FrigateShip: new Action(
      "Gateway Frigate Ship",
      "galaxy",
      "frigate_ship",
      "gxy_gateway",
      { ship: true }
    ),
    CruiserShip: new Action(
      "Gateway Cruiser Ship",
      "galaxy",
      "cruiser_ship",
      "gxy_gateway",
      { ship: true }
    ),
    Dreadnought: new Action(
      "Gateway Dreadnought",
      "galaxy",
      "dreadnought",
      "gxy_gateway",
      { ship: true }
    ),
  
    StargateStation: new Action(
      "Stargate Station",
      "galaxy",
      "gateway_station",
      "gxy_stargate"
    ),
    StargateTelemetryBeacon: new Action(
      "Stargate Telemetry Beacon",
      "galaxy",
      "telemetry_beacon",
      "gxy_stargate",
      { knowledge: true }
    ),
    StargateDepot: new Action(
      "Stargate Depot",
      "galaxy",
      "gateway_depot",
      "gxy_stargate",
      { smart: true }
    ),
    StargateDefensePlatform: new Action(
      "Stargate Defense Platform",
      "galaxy",
      "defense_platform",
      "gxy_stargate"
    ),
  
    GorddonMission: new Action(
      "Gorddon Mission",
      "galaxy",
      "gorddon_mission",
      "gxy_gorddon"
    ),
    GorddonEmbassy: new Action(
      "Gorddon Embassy",
      "galaxy",
      "embassy",
      "gxy_gorddon",
      { housing: true }
    ),
    GorddonDormitory: new Action(
      "Gorddon Dormitory",
      "galaxy",
      "dormitory",
      "gxy_gorddon",
      { housing: true }
    ),
    GorddonSymposium: new Action(
      "Gorddon Symposium",
      "galaxy",
      "symposium",
      "gxy_gorddon",
      { knowledge: true }
    ),
    GorddonFreighter: new Action(
      "Gorddon Freighter",
      "galaxy",
      "freighter",
      "gxy_gorddon",
      { ship: true }
    ),
  
    Alien1Consulate: new Action(
      "Alien 1 Consulate",
      "galaxy",
      "consulate",
      "gxy_alien1",
      { housing: true }
    ),
    Alien1Resort: new Action("Alien 1 Resort", "galaxy", "resort", "gxy_alien1"),
    Alien1VitreloyPlant: new Action(
      "Alien 1 Vitreloy Plant",
      "galaxy",
      "vitreloy_plant",
      "gxy_alien1",
      { smart: true }
    ),
    Alien1SuperFreighter: new Action(
      "Alien 1 Super Freighter",
      "galaxy",
      "super_freighter",
      "gxy_alien1",
      { ship: true }
    ),
  
    Alien2Mission: new Action(
      "Alien 2 Mission",
      "galaxy",
      "alien2_mission",
      "gxy_alien2"
    ),
    Alien2Foothold: new Action(
      "Alien 2 Foothold",
      "galaxy",
      "foothold",
      "gxy_alien2"
    ),
    Alien2ArmedMiner: new Action(
      "Alien 2 Armed Miner",
      "galaxy",
      "armed_miner",
      "gxy_alien2",
      { ship: true, smart: true }
    ),
    Alien2OreProcessor: new Action(
      "Alien 2 Ore Processor",
      "galaxy",
      "ore_processor",
      "gxy_alien2"
    ),
    Alien2Scavenger: new Action(
      "Alien 2 Scavenger",
      "galaxy",
      "scavenger",
      "gxy_alien2",
      { knowledge: true, ship: true }
    ),
  
    ChthonianMission: new Action(
      "Chthonian Mission",
      "galaxy",
      "chthonian_mission",
      "gxy_chthonian"
    ),
    ChthonianMineLayer: new Action(
      "Chthonian Mine Layer",
      "galaxy",
      "minelayer",
      "gxy_chthonian",
      { ship: true, smart: true }
    ),
    ChthonianExcavator: new Action(
      "Chthonian Excavator",
      "galaxy",
      "excavator",
      "gxy_chthonian",
      { smart: true }
    ),
    ChthonianRaider: new Action(
      "Chthonian Raider",
      "galaxy",
      "raider",
      "gxy_chthonian",
      { ship: true, smart: true }
    ),
  
    PortalTurret: new Action(
      "Portal Laser Turret",
      "portal",
      "turret",
      "prtl_fortress"
    ),
    PortalCarport: new Action(
      "Portal Surveyor Carport",
      "portal",
      "carport",
      "prtl_fortress"
    ),
    PortalWarDroid: new Action(
      "Portal War Droid",
      "portal",
      "war_droid",
      "prtl_fortress"
    ),
    PortalRepairDroid: new Action(
      "Portal Repair Droid",
      "portal",
      "repair_droid",
      "prtl_fortress"
    ),
  
    BadlandsPredatorDrone: new Action(
      "Badlands Predator Drone",
      "portal",
      "war_drone",
      "prtl_badlands"
    ),
    BadlandsSensorDrone: new Action(
      "Badlands Sensor Drone",
      "portal",
      "sensor_drone",
      "prtl_badlands"
    ),
    BadlandsAttractor: new Action(
      "Badlands Attractor Beacon",
      "portal",
      "attractor",
      "prtl_badlands",
      { smart: true }
    ),
  
    PitMission: new Action("Pit Mission", "portal", "pit_mission", "prtl_pit"),
    PitAssaultForge: new Action(
      "Pit Assault Forge",
      "portal",
      "assault_forge",
      "prtl_pit"
    ),
    PitSoulForge: new Action(
      "Pit Soul Forge",
      "portal",
      "soul_forge",
      "prtl_pit"
    ),
    PitGunEmplacement: new Action(
      "Pit Gun Emplacement",
      "portal",
      "gun_emplacement",
      "prtl_pit"
    ),
    PitSoulAttractor: new Action(
      "Pit Soul Attractor",
      "portal",
      "soul_attractor",
      "prtl_pit"
    ),
  
    RuinsMission: new Action(
      "Ruins Mission",
      "portal",
      "ruins_mission",
      "prtl_ruins"
    ),
    RuinsGuardPost: new Action(
      "Ruins Guard Post",
      "portal",
      "guard_post",
      "prtl_ruins",
      { smart: true }
    ),
    RuinsVault: new Action("Ruins Vault", "portal", "vault", "prtl_ruins"),
    RuinsArchaeology: new Action(
      "Ruins Archaeology",
      "portal",
      "archaeology",
      "prtl_ruins"
    ),
    RuinsArcology: new Action(
      "Ruins Arcology",
      "portal",
      "arcology",
      "prtl_ruins"
    ),
    RuinsHellForge: new Action(
      "Ruins Infernal Forge",
      "portal",
      "hell_forge",
      "prtl_ruins"
    ),
    RuinsInfernoPower: new Action(
      "Ruins Inferno Reactor",
      "portal",
      "inferno_power",
      "prtl_ruins"
    ),
    RuinsAncientPillars: new Action(
      "Ruins Ancient Pillars",
      "portal",
      "ancient_pillars",
      "prtl_ruins"
    ),
  
    GateMission: new Action(
      "Gate Mission",
      "portal",
      "gate_mission",
      "prtl_gate"
    ),
    GateEastTower: new Action(
      "Gate East Tower",
      "portal",
      "east_tower",
      "prtl_gate"
    ),
    GateWestTower: new Action(
      "Gate West Tower",
      "portal",
      "west_tower",
      "prtl_gate"
    ),
    GateTurret: new Action("Gate Turret", "portal", "gate_turret", "prtl_gate"),
    GateInferniteMine: new Action(
      "Gate Infernite Mine",
      "portal",
      "infernite_mine",
      "prtl_gate"
    ),
  
    LakeMission: new Action(
      "Lake Mission",
      "portal",
      "lake_mission",
      "prtl_lake"
    ),
    LakeHarbour: new Action("Lake Harbour", "portal", "harbour", "prtl_lake", {
      smart: true,
    }),
    LakeCoolingTower: new Action(
      "Lake Cooling Tower",
      "portal",
      "cooling_tower",
      "prtl_lake",
      { smart: true }
    ),
    LakeBireme: new Action(
      "Lake Bireme Warship",
      "portal",
      "bireme",
      "prtl_lake",
      { smart: true }
    ),
    LakeTransport: new Action(
      "Lake Transport",
      "portal",
      "transport",
      "prtl_lake",
      { smart: true }
    ),
  
    SpireMission: new Action(
      "Spire Mission",
      "portal",
      "spire_mission",
      "prtl_spire"
    ),
    SpirePurifier: new Action(
      "Spire Purifier",
      "portal",
      "purifier",
      "prtl_spire",
      { smart: true }
    ),
    SpirePort: new Action("Spire Port", "portal", "port", "prtl_spire", {
      smart: true,
    }),
    SpireBaseCamp: new Action(
      "Spire Base Camp",
      "portal",
      "base_camp",
      "prtl_spire",
      { smart: true }
    ),
    SpireBridge: new Action("Spire Bridge", "portal", "bridge", "prtl_spire"),
    SpireSphinx: new Action("Spire Sphinx", "portal", "sphinx", "prtl_spire"),
    SpireBribeSphinx: new Action(
      "Spire Bribe Sphinx",
      "portal",
      "bribe_sphinx",
      "prtl_spire"
    ),
    SpireSurveyTower: new Action(
      "Spire Survey Tower",
      "portal",
      "spire_survey",
      "prtl_spire"
    ),
    SpireMechBay: new Action(
      "Spire Mech Bay",
      "portal",
      "mechbay",
      "prtl_spire",
      { smart: true }
    ),
    SpireTower: new Action("Spire Tower", "portal", "spire", "prtl_spire"),
    SpireWaygate: new Action(
      "Portal Waygate",
      "portal",
      "waygate",
      "prtl_spire",
      { smart: true }
    ),
  };
  
  let projects = {
    LaunchFacility: new Project("Launch Facility", "launch_facility"),
    SuperCollider: new Project("Supercollider", "lhc"),
    StockExchange: new Project("Stock Exchange", "stock_exchange"),
    Monument: new Project("Monument", "monument"),
    Railway: new Project("Railway", "railway"),
    Nexus: new Project("Nexus", "nexus"),
    RoidEject: new Project("Asteroid Redirect", "roid_eject"),
    ManaSyphon: new Project("Mana Syphon", "syphon"),
  };

  let jobs = {
    Unemployed: new Job("unemployed", "Unemployed"),
    Hunter: new Job("hunter", "Hunter"),
    Farmer: new Job("farmer", "Farmer"),
    //Forager: new Job("forager", "Forager"),
    Lumberjack: new Job("lumberjack", "Lumberjack"),
    QuarryWorker: new Job("quarry_worker", "Quarry Worker"),
    CrystalMiner: new Job("crystal_miner", "Crystal Miner"),
    Scavenger: new Job("scavenger", "Scavenger"),

    Miner: new Job("miner", "Miner"),
    CoalMiner: new Job("coal_miner", "Coal Miner"),
    CementWorker: new Job("cement_worker", "Cement Worker"),
    Entertainer: new Job("entertainer", "Entertainer"),
    Priest: new Job("priest", "Priest"),
    Professor: new Job("professor", "Professor"),
    Scientist: new Job("scientist", "Scientist"),
    Banker: new Job("banker", "Banker"),
    Colonist: new Job("colonist", "Colonist"),
    SpaceMiner: new Job("space_miner", "Space Miner"),
    HellSurveyor: new Job("hell_surveyor", "Hell Surveyor"),
    Archaeologist: new Job("archaeologist", "Archaeologist"),
}
  
  // We'll need real window to access vue objects
  if (typeof unsafeWindow !== "undefined") {
    win = unsafeWindow;
  } else {
    win = window;
  }
  game = win.evolve;
  game.updateDebugData();
  
  let techIds = {};
  let buildingIds = {};
  let arpaIds = {};
  
  // Init researches
  for (let [key, action] of Object.entries(game.actions.tech)) {
    techIds[action.id] = new Technology(key);
  }
  
  // Init lookup table for buildings
  for (let building of Object.values(buildings)) {
    buildingIds[building._vueBinding] = building;
  }
  
  // ...and projects
  for (let project of Object.values(projects)) {
    arpaIds[project._vueBinding] = project;
  }
  
  new MutationObserver(addTooltip).observe(document.getElementById("main"), {
    childList: true,
  });
  
  function haveTech(research, level = 1) {
    return game.global.tech[research] && game.global.tech[research] >= level;
  }
  
  function addTooltip(mutations) {
    game.updateDebugData();
    mutations.forEach((mutation) =>
      mutation.addedNodes.forEach((node) => {
        if (node.id === "popper") {
          let dataId = node.dataset.id;
  
          let match = null;
          let obj = null;
          if ((match = dataId.match(/^popArpa([a-z_-]+)\d*$/))) {
            // "popArpa[id-with-no-tab][quantity]" for projects
            obj = arpaIds["arpa" + match[1]];
          } else if ((match = dataId.match(/^q([a-z_-]+)\d*$/))) {
            // "q[id][order]" for buildings in queue
            obj = buildingIds[match[1]] || arpaIds[match[1]];
          } else {
            // "[id]" for buildings and researches
            obj = buildingIds[dataId] || techIds[dataId];
          }
  
          if (!obj || (obj instanceof Technology && obj.isResearched())) {
            return;
          }
  
          let description = getTooltipInfo(obj);
          if (description) {
            node.innerHTML += `<div style="border-top: solid .0625rem #999">${description}</div>`;
          }
        }
      })
    );
  }
  
  function getWorldColliderMulti() {
    let boost = 0;
  
    if (buildings.DwarfWorldController.stateOnCount) {
      boost = 0.25;
      boost += buildings.BlackholeFarReach.stateOnCount * 0.01;
      boost += haveTech("science", 19) ? 0.15 : 0;
    }
  
    return 1 + boost;
  }
  
  function wardenLabel() {
    if (game.global.race.universe === "magic") {
      return game.loc("city_wizard_tower_title");
    } else {
      return game.global.race["evil"]
        ? game.loc("city_babel_title")
        : game.loc("city_wardenclyffe");
    }
  }
  
  function getCitadelConsumption(amount) {
    return (
      (30 + (amount - 1) * 2.5) * amount * (game.global.race["emfield"] ? 1.5 : 1)
    );
  }
  
  function getTooltipInfo(obj) {
    let notes = [];
    if (obj === buildings.NeutronCitadel) {
      notes.push(
        `Next level will increase total consumption by ${
          getCitadelConsumption(obj.stateOnCount + 1) -
          getCitadelConsumption(obj.stateOnCount)
        } MW`
      );
    }
  
    if (obj === buildings.University) {
      let gain = 0;
  
      if (buildings.University.count === 0) {
        gain += parseFloat(
          game.actions.city.university
            .effect()
            .match(/(?<=\+)[0-9]+(?= Max Knowledge)/)[0]
        );
      } else {
        gain +=
          parseFloat(game.breakdown.c.Knowledge[game.loc("city_university")]) /
          buildings.University.count;
      }
  
      gain *= getWorldColliderMulti();
  
      notes.push(`+${Math.round(gain)} Max Knowledge`);
    }
  
    if (obj === buildings.Library) {
      let gain = 0;
  
      if (buildings.Library.count === 0) {
        gain += parseFloat(
          game.actions.city.library
            .effect()
            .match(/(?<=\+)[0-9]+(?= Max Knowledge)/)[0]
        );
      } else {
        gain +=
          parseFloat(game.breakdown.c.Knowledge[game.loc("city_library")]) /
          buildings.Library.count;
      }
  
      if (haveTech("science", 4)) {
        gain +=
          (0.02 *
            parseFloat(
              game.breakdown.c.Knowledge[game.loc("city_university")] ?? 0
            )) /
          (1 +
            buildings.Library.count * 0.02 +
            buildings.MoonObservatory.stateOnCount * 0.05 +
            (haveTech("science", 14)
              ? buildings.BadlandsSensorDrone.stateOnCount * 0.02
              : 0));
      }
  
      gain *= getWorldColliderMulti();
  
      notes.push(`+${Math.round(gain)} Max Knowledge`);
    }
  
    if (obj === buildings.Wardenclyffe) {
      let gain = 0;
  
      if (buildings.Wardenclyffe.count === 0) {
        gain += parseFloat(
          game.actions.city.wardenclyffe
            .effect()
            .match(/(?<=\+)[0-9]+(?= Max Knowledge)/)[0]
        );
      } else {
        gain +=
          parseFloat(game.breakdown.c.Knowledge[wardenLabel()]) /
          buildings.Wardenclyffe.count;
      }
  
      if (haveTech("science", 15)) {
        gain +=
          (0.02 *
            parseFloat(
              game.breakdown.c.Knowledge[
                game.loc(
                  game.global.race.universe === "magic"
                    ? "tech_sanctum"
                    : "interstellar_laboratory_title"
                )
              ] ?? 0
            )) /
          (1 + buildings.Wardenclyffe.count * 0.02);
      }
  
      gain *= getWorldColliderMulti();
  
      notes.push(`+${Math.round(gain)} Max Knowledge`);
    }
  
    if (obj === buildings.SpaceSatellite) {
      let gain = 0;
  
      if (buildings.SpaceSatellite.count === 0) {
        gain += parseFloat(
          game.actions.space.spc_home.satellite
            .effect()
            .match(/(?<=\+)[0-9]+(?= Max Knowledge)/)[0]
        );
      } else {
        gain +=
          parseFloat(
            game.breakdown.c.Knowledge[game.loc("space_home_satellite_title")]
          ) / buildings.SpaceSatellite.count;
      }
  
      gain +=
        (0.04 * parseFloat(game.breakdown.c.Knowledge[wardenLabel()] ?? 0)) /
        (1 + buildings.SpaceSatellite.count * 0.04);
  
      gain *= getWorldColliderMulti();
  
      notes.push(`+${Math.round(gain)} Max Knowledge`);
    }
  
    if (obj === buildings.MoonObservatory) {
      let gain = 0;
  
      if (buildings.MoonObservatory.stateOnCount === 0) {
        gain += parseFloat(
          game.actions.space.spc_moon.observatory
            .effect()
            .match(/(?<=\+)[0-9]+(?= Max Knowledge)/)[0]
        );
      } else {
        gain +=
          parseFloat(
            game.breakdown.c.Knowledge[game.loc("space_moon_observatory_title")]
          ) / buildings.MoonObservatory.stateOnCount;
      }
  
      gain +=
        (0.05 *
          parseFloat(
            game.breakdown.c.Knowledge[game.loc("city_university")] ?? 0
          )) /
        (1 +
          buildings.Library.count * (haveTech("science", 4) ? 0.02 : 0) +
          buildings.MoonObservatory.stateOnCount * 0.05 +
          (haveTech("science", 14)
            ? buildings.BadlandsSensorDrone.stateOnCount * 0.02
            : 0));
  
      if (game.global.race["cataclysm"]) {
        gain +=
          (0.25 *
            parseFloat(
              game.breakdown.c.Knowledge[game.loc("tech_exotic_bd")] ?? 0
            )) /
          (1 + buildings.MoonObservatory.stateOnCount * 0.25);
      }
  
      gain *= getWorldColliderMulti();
  
      notes.push(`+${Math.round(gain)} Max Knowledge`);
    }
  
    if (obj === buildings.RedExoticLab) {
      let gain = 0;
  
      if (buildings.RedExoticLab.stateOnCount === 0) {
        gain +=
          parseFloat(
            game.actions.space.spc_red.exotic_lab
              .effect()
              .match(/(?<=\+)[0-9]+(?= Max Knowledge)/)[0]
          ) * jobs.Colonist.count;
      } else {
        gain +=
          parseFloat(game.breakdown.c.Knowledge[game.loc("tech_exotic_bd")]) /
          buildings.RedExoticLab.stateOnCount;
      }
  
      if (game.global.race["cataclysm"] && haveTech("science", 15)) {
        gain +=
          (0.02 *
            parseFloat(
              game.breakdown.c.Knowledge[
                game.loc(
                  game.global.race.universe === "magic"
                    ? "tech_sanctum"
                    : "interstellar_laboratory_title"
                )
              ] ?? 0
            )) /
          (1 + buildings.RedExoticLab.stateOnCount * 0.02);
      }
  
      gain *= getWorldColliderMulti();
  
      notes.push(`+${Math.round(gain)} Max Knowledge`);
    }
  
    if (obj === buildings.AlphaLaboratory) {
      let gain = 0;
  
      if (buildings.AlphaLaboratory.stateOnCount === 0) {
        gain += parseFloat(
          game.actions.interstellar.int_alpha.laboratory
            .effect()
            .match(/(?<=\+)[0-9]+(?= Max Knowledge)/)[0]
        );
      } else {
        gain +=
          parseFloat(
            game.breakdown.c.Knowledge[
              game.loc(
                game.global.race.universe === "magic"
                  ? "tech_sanctum"
                  : "interstellar_laboratory_title"
              )
            ]
          ) / buildings.AlphaLaboratory.stateOnCount;
      }
  
      gain +=
        (0.05 *
          parseFloat(
            game.breakdown.c.Knowledge[game.loc("tech_exotic_bd")] ?? 0
          )) /
        (1 +
          (haveTech("science", 13)
            ? buildings.AlphaLaboratory.stateOnCount * 0.05
            : 0) +
          (haveTech("ancient_study", 2)
            ? buildings.RedZiggurat.stateOnCount * 0.03
            : 0) +
          (haveTech("mass", 2)
            ? buildings.MassDriver.stateOnCount * jobs.Scientist.count * 0.002
            : 0));
  
      gain *= getWorldColliderMulti();
  
      notes.push(`+${Math.round(gain)} Max Knowledge`);
    }
  
    if (obj === buildings.BlackholeFarReach) {
      let gain = 0;
  
      gain += (0.01 * resources.Knowledge.maxQuantity) / getWorldColliderMulti();
  
      notes.push(`+${Math.round(gain)} Max Knowledge`);
    }
  
    if (obj === buildings.StargateTelemetryBeacon) {
      let gain = 0;
  
      let base_val = haveTech("telemetry") ? 1200 : 800;
      if (haveTech("science", 17)) {
        base_val += buildings.ScoutShip.stateOnCount * 25;
      }
      gain += (buildings.StargateTelemetryBeacon.stateOnCount * 2 + 1) * base_val;
  
      gain *= getWorldColliderMulti();
  
      notes.push(`+${Math.round(gain)} Max Knowledge`);
    }
  
    if (obj === buildings.BadlandsSensorDrone && haveTech("science", 14)) {
      let gain = 0;
  
      if (buildings.BadlandsSensorDrone.stateOnCount === 0) {
        gain += parseFloat(
          game.actions.portal.prtl_badlands.sensor_drone
            .effect()
            .match(/(?<=\+)[0-9]+(?= Max Knowledge)/)[0]
        );
      } else {
        gain +=
          parseFloat(
            game.breakdown.c.Knowledge[game.loc("portal_sensor_drone_title")]
          ) / buildings.BadlandsSensorDrone.stateOnCount;
      }
  
      gain +=
        (0.02 *
          parseFloat(
            game.breakdown.c.Knowledge[game.loc("city_university")] ?? 0
          )) /
        (1 +
          buildings.Library.count * 0.02 +
          buildings.MoonObservatory.stateOnCount * 0.05 +
          buildings.BadlandsSensorDrone.stateOnCount * 0.02);
  
      if (game.global.race["cataclysm"]) {
        gain +=
          (0.02 *
            parseFloat(
              game.breakdown.c.Knowledge[game.loc("tech_exotic_bd")] ?? 0
            )) /
          (1 + buildings.BadlandsSensorDrone.stateOnCount * 0.02);
      } else {
        gain +=
          (0.02 *
            parseFloat(
              game.breakdown.c.Knowledge[game.loc("city_biolab")] ?? 0
            )) /
          (1 + buildings.BadlandsSensorDrone.stateOnCount * 0.02);
      }
  
      gain *= getWorldColliderMulti();
  
      notes.push(`+${Math.round(gain)} Max Knowledge`);
    }
  
    // Other tooltips goes here...
  
    return notes.join("<br>");
  }
  
})();