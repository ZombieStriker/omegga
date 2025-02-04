const { color, brick: brickUtils } = require('../util/');

class Player {
  #omegga = null;

  /**
   * players are not to be constructed
   * @constructor
   * @param  {Omegga} - Omegga Instance
   * @param  {String} - Player Name
   * @param  {String} - Player Id
   * @param  {String} - Player Controller
   * @param  {String} - Player State
   */
  constructor(omegga, name, id, controller, state) {
    this.#omegga = omegga;
    this.name = name;
    this.id = id;
    this.controller = controller;
    this.state = state;
  }

  /**
   * Returns omegga
   * @return {Omegga}
   */
  getOmegga() {
    return this.#omegga;
  }

  /**
   * Clone a player
   * @return {Player}
   */
  clone() {
    return new Player(
      this.#omegga,
      this.name,
      this.id,
      this.controller,
      this.state
    );
  }

  /**
   * Get raw player info (to feed into a constructor)
   * @return {Array<String>}
   */
  raw() {
    return [this.name, this.id, this.controller, this.state];
  }

  /**
   * true if the player is the host
   * @return {Boolean}
   */
  isHost() {
    return this.#omegga.host.id === this.id;
  }

  /**
   * clear this player's bricks
   * @param  {Boolean} - quiet mode
   */
  clearBricks(quiet = false) {
    this.#omegga.clearBricks(this.id, quiet);
  }

  /**
   * get a player's roles, if any
   * @param  {Omegga} - omegga instance
   * @param  {String} - player uuid
   * @return {Array<String>} - list of roles
   */
  static getRoles(omegga, id) {
    const data = omegga.getRoleAssignments().savedPlayerRoles[id];
    return Object.freeze(data && data.roles ? data.roles : []);
  }

  /**
   * get a player's roles, if any
   * @return {Array<String>}
   */
  getRoles() {
    return Player.getRoles(this.#omegga, this.id);
  }

  /**
   * get a player's permissions in a map like `{"Bricks.ClearOwn": true, ...}`
   * @param  {Omegga} - Omegga instance
   * @param  {String} - player uuid
   * @return {Object} - permissions map
   */
  static getPermissions(omegga, id) {
    const { roles, defaultRole } = omegga.getRoleSetup();

    // if the player is the host, the player has every permission
    if (omegga.host.id === id) {
      return Object.freeze(
        Object.fromEntries(
          [].concat(
            defaultRole.permissions.map(p => [p.name, true]),
            // sometimes the default role does not have every permission listed
            ...roles.map(r => r.permissions.map(p => [p.name, true]))
          )
        )
      );
    }

    const DEFAULT_PERMS = {
      moderator: [
        'Bricks.ClearAll',
        'Minigame.AlwaysLeave',
        'Players.Kick',
        'Players.TPInMinigame',
        'Players.TPOthers',
        'Self.Ghost',
      ],
      admin: [
        'Bricks.ClearAll',
        'Bricks.ClearOwn',
        'Bricks.IgnoreTrust',
        'Bricks.Load',
        'Map.Environment',
        'Minigame.AlwaysEdit',
        'Minigame.AlwaysLeave',
        'Minigame.AlwaysSwitchTeam',
        'Minigame.MakeDefault',
        'Minigame.MakePersistent',
        'Minigame.UseAllBricks',
        'Players.Ban',
        'Players.Kick',
        'Players.TPInMinigame',
        'Players.TPOthers',
        'Roles.Grant',
        'Self.Ghost',
        'Server.ChangeRoles',
        'Server.ChangeSettings',
        'Server.FreezeCamera',
        'Tools.Selector.BypassLimits',
        'Tools.Selector.BypassTimeouts',
      ],
    };

    // get the player's roles
    const playerRoles = Player.getRoles(omegga, id).map(r => r.toLowerCase());

    // default player permissions
    const permissions = {
      'Bricks.ClearAll': false,
      'Bricks.ClearOwn': true,
      'Bricks.Delete': true,
      'Bricks.Edit': true,
      'Bricks.IgnoreTrust': false,
      'Bricks.Paint': true,
      'Bricks.Place': true,
      'BricksItems.Spawn': true,
      'Map.Change': false,
      'Map.Environment': false,
      'Map.SetSpawn': false,
      'Minigame.AlwaysEdit': false,
      'Minigame.AlwaysLeave': false,
      'Minigame.AlwaysSwitchTeam': false,
      'Minigame.Create': true,
      'Minigame.MakePersistent': false,
      'Minigame.UseAllBricks': false,
      'Players.Ban': false,
      'Players.TPInMinigame': false,
      'Players.TPOthers': false,
      'Players.TPSelf': true,
      'Roles.Grant': false,
      'Self.Flashlight': true,
      'Self.Fly': true,
      'Self.FreezeCamera': false,
      'Self.Ghost': false,
      'Self.Sprint': true,
      'Self.Suicide': true,
      'Tools.Selector.Use': true,
    };

    // apply all permissions from default role
    for (const p of defaultRole.permissions) {
      // technically this can never be Unchanged so it's always on enabled or allowed
      permissions[p.name] =
        p.state === 'Unchanged'
          ? permissions[p.name]
          : !!p.bEnabled || p.state === 'Allowed';
    }

    // loop through all the roles
    for (const role of roles) {
      // ignore ones the player does not have
      if (!playerRoles.includes(role.name.toLowerCase())) continue;

      const defaultPerms = DEFAULT_PERMS[role.name.toLowerCase()] || [];
      // iterate through default permissions
      for (const perm of defaultPerms) {
        // if they are not overriden, set it to true
        if (!role.permissions.find(r => r.name === perm))
          permissions[perm] = true;
      }

      // add all the new permissions the player now has
      for (const p of role.permissions) {
        // permission is disabled on forbidden, persisted on unchanged, and enabled on bEnabled or Allowed
        permissions[p.name] =
          p.state !== 'Forbidden' &&
          (p.state === 'Unchanged'
            ? permissions[p.name]
            : permissions[p.name] || p.bEnabled || p.state === 'Allowed');
        permissions[p.name] = permissions[p.name] || p.bEnabled;
      }
    }

    return Object.freeze(permissions);
  }

  /**
   * get a player's permissions in a map like `{"Bricks.ClearOwn": true, ...}`
   * @return {Object} - permissions map
   */
  getPermissions() {
    return Player.getPermissions(this.#omegga, this.id);
  }

  /**
   * get player's name color
   * @return {String} - 6 character hex string
   */
  getNameColor() {
    const { roles, defaultRole, ownerRoleColor, bOwnerRoleHasColor } =
      this.#omegga.getRoleSetup();

    // host check if host has host color
    if (this.isHost() && bOwnerRoleHasColor)
      return color.rgbToHex(ownerRoleColor);

    // get the player's role
    const playerRoles = this.getRoles().map(r => r.toLowerCase());

    // only if the player actually has roles...
    if (playerRoles.length > 0) {
      // check the role list in reverse for the player's role (highest tier first)
      const found = roles
        .slice()
        .reverse()
        .find(
          role =>
            role.bHasColor && playerRoles.includes(role.name.toLowerCase())
        );

      if (found) return color.rgbToHex(found.color);
    }

    return color.rgbToHex(
      defaultRole.bHasColor
        ? defaultRole.color
        : { r: 255, g: 255, b: 255, a: 255 }
    );
  }

  /**
   * get player's position
   * @return {Promise<List<Number>>} - [x, y, z] coordinates
   */
  async getPosition() {
    // this is here because my text editor had weird syntax highlighting glitches when the other omeggas were replaced with this.#omegga...
    // guess the code is "too new" :egg:
    const omegga = this.#omegga;

    // given a player controller, match the player's pawn
    const pawnRegExp = new RegExp(
      `BP_PlayerController_C .+?PersistentLevel\\.${this.controller}\\.Pawn = BP_FigureV2_C'.+?:PersistentLevel.(?<pawn>BP_FigureV2_C_\\d+)'`
    );

    // wait for the pawn watcher to return a pawn
    const [
      {
        groups: { pawn },
      },
    ] = await omegga.addWatcher(pawnRegExp, {
      // request the pawn for this player's controller (should only be one)
      exec: () =>
        omegga.writeln(
          `GetAll BP_PlayerController_C Pawn Name=${this.controller}`
        ),
      timeoutDelay: 100,
    });

    // given a player's pawn, match the player's position
    const posRegExp = new RegExp(
      `CapsuleComponent .+?PersistentLevel\\.${pawn}\\.CollisionCylinder\\.RelativeLocation = \\(X=(?<x>[\\d\\.-]+),Y=(?<y>[\\d\\.-]+),Z=(?<z>[\\d\\.-]+)\\)`
    );

    // wait for the position promise
    const [
      {
        groups: { x, y, z },
      },
    ] = await omegga.addWatcher(posRegExp, {
      // request the position for this player's pawn
      exec: () =>
        omegga.writeln(
          `GetAll SceneComponent RelativeLocation Name=CollisionCylinder Outer=${pawn}`
        ),
      timeoutDelay: 100,
    });

    // return the player's position as an array of numbers
    return [x, y, z].map(Number);
  }

  /**
   * gets a user's ghost brick info (by uuid, name, controller, or player object)
   * @return {Promise<Object>} - ghost brick data
   */
  async getGhostBrick() {
    const { controller } = this;

    const ownerRegExp =
      /^(?<index>\d+)\) BrickGridPreviewActor (.+):PersistentLevel\.(?<actor>BrickGridPreviewActor_\d+)\.Owner = BP_PlayerController_C'(.+):PersistentLevel\.(?<controller>BP_PlayerController_C_\d+)'$/;
    const transformParamsRegExp =
      /^(?<index>\d+)\) BrickGridPreviewActor (.+):PersistentLevel\.(?<actor>BrickGridPreviewActor_\d+)\.TransformParameters = \(TargetGrid=("(?<targetGrid>.+)"|None),Position=\(X=(?<x>.+),Y=(?<y>.+),Z=(?<z>.+)\),Orientation=(?<orientation>.+)\)$/;

    const [owners, transformParams] = await Promise.all([
      this.#omegga.watchLogChunk(
        'GetAll BrickGridPreviewActor Owner',
        ownerRegExp,
        { first: 'index', timeoutDelay: 500 }
      ),
      this.#omegga.watchLogChunk(
        'GetAll BrickGridPreviewActor TransformParameters',
        transformParamsRegExp,
        { first: 'index', timeoutDelay: 500 }
      ),
    ]);

    // get BrickGridPreviewActor by controller
    const owner = owners.find(owner => owner.groups.controller === controller);

    if (!owner) return;

    const actor = owner.groups.actor;
    // get transform parameters for the found actor
    const transformParameters = transformParams.find(
      transformParameters => transformParameters.groups.actor === actor
    );

    if (!transformParameters) return;

    return {
      targetGrid: transformParameters.groups.targetGrid,
      location: [
        +transformParameters.groups.x,
        +transformParameters.groups.y,
        +transformParameters.groups.z,
      ],
      orientation: transformParameters.groups.orientation,
    };
  }

  /**
   * gets a user's paint tool properties
   * @return {Promise<Object>} - paint data
   */
  async getPaint() {
    const { controller } = this;

    const ownerRegExp =
      /^(?<index>\d+)\) BP_Item_PaintTool_C (.+):PersistentLevel\.(?<actor>BP_Item_PaintTool_C_\d+)\.Owner = BP_PlayerController_C'(.+):PersistentLevel\.(?<controller>BP_PlayerController_C_\d+)'$/;
    const colorRegExp =
      /^(?<index>\d+)\) BP_Item_PaintTool_C (.+):PersistentLevel\.(?<actor>BP_Item_PaintTool_C_\d+)\.SelectedColor = \(B=(?<b>.+),G=(?<g>.+),R=(?<r>.+),A=(?<a>.+)\)$/;
    const materialRegExp =
      /^(?<index>\d+)\) BP_Item_PaintTool_C (.+):PersistentLevel\.(?<actor>BP_Item_PaintTool_C_\d+)\.SelectedMaterialId = (?<materialIndex>\d+)$/;
    const materialAlphaRegExp =
      /^(?<index>\d+)\) BP_Item_PaintTool_C (.+):PersistentLevel\.(?<actor>BP_Item_PaintTool_C_\d+)\.SelectedMaterialAlpha = (?<materialAlpha>\d+)$/;

    const [owners, colorMatch, materialMatch, materialAlphaMatch] =
      await Promise.all([
        this.#omegga.watchLogChunk(
          'GetAll BP_Item_PaintTool_C Owner',
          ownerRegExp,
          { first: 'index', timeoutDelay: 500 }
        ),
        this.#omegga.watchLogChunk(
          'GetAll BP_Item_PaintTool_C SelectedColor',
          colorRegExp,
          { first: 'index', timeoutDelay: 500 }
        ),
        this.#omegga.watchLogChunk(
          'GetAll BP_Item_PaintTool_C SelectedMaterialId',
          materialRegExp,
          { first: 'index', timeoutDelay: 500 }
        ),
        this.#omegga.watchLogChunk(
          'GetAll BP_Item_PaintTool_C SelectedMaterialAlpha',
          materialAlphaRegExp,
          { first: 'index', timeoutDelay: 500 }
        ),
      ]);

    // get BrickGridPreviewActor by controller
    const owner = owners.find(owner => owner.groups.controller === controller);

    if (!owner) return;

    const actor = owner.groups.actor;
    // get transform parameters for the found actor
    const color = colorMatch.find(color => color.groups.actor === actor);
    const material = materialMatch.find(
      material => material.groups.actor === actor
    );
    const materialAlpha = materialAlphaMatch.find(
      materialAlpha => materialAlpha.groups.actor === actor
    );

    if (!color || !material || !materialAlpha) return;

    const colorRaw = [+color.groups.r, +color.groups.g, +color.groups.b];
    return {
      materialIndex: material.groups.materialIndex,
      materialAlpha: materialAlpha.groups.materialAlpha,
      material:
        brickUtils.BRICK_CONSTANTS.DEFAULT_MATERIALS[
          material.groups.materialIndex
        ],
      color: colorRaw,
    };
  }

  /**
   * gets the bounds of the template in the user's clipboard (bounds of original selection box)
   * @return {Promise<Object>} - template bounds
   */
  async getTemplateBounds() {
    const { controller } = this;

    const brickTemplateRegExp =
      /^(?<index>\d+)\) BP_PlayerController_C (.+):PersistentLevel\.(?<controller>BP_PlayerController_C_\d+)\.TEMP_BrickTemplate_Server = BrickBuildingTemplate'(.+)Transient.(?<templateName>BrickBuildingTemplate_\d+)'$/;
    const minBoundsRegExp =
      /^(?<index>\d+)\) BrickBuildingTemplate (.+)Transient\.(?<templateName>BrickBuildingTemplate_\d+)\.MinBounds = \(X=(?<x>.+),Y=(?<y>.+),Z=(?<z>.+)\)$/;
    const maxBoundsRegExp =
      /^(?<index>\d+)\) BrickBuildingTemplate (.+)Transient\.(?<templateName>BrickBuildingTemplate_\d+)\.MaxBounds = \(X=(?<x>.+),Y=(?<y>.+),Z=(?<z>.+)\)$/;
    const centerRegExp =
      /^(?<index>\d+)\) BrickBuildingTemplate (.+)Transient\.(?<templateName>BrickBuildingTemplate_\d+)\.Center = \(X=(?<x>.+),Y=(?<y>.+),Z=(?<z>.+)\)$/;

    const [template, minBounds, maxBounds, centers] = await Promise.all([
      this.#omegga.watchLogChunk(
        `GetAll BP_PlayerController_C TEMP_BrickTemplate_Server Name=${controller}`,
        brickTemplateRegExp,
        { first: 'index' }
      ),
      this.#omegga.watchLogChunk(
        'GetAll BrickBuildingTemplate MinBounds',
        minBoundsRegExp,
        { first: 'index' }
      ),
      this.#omegga.watchLogChunk(
        'GetAll BrickBuildingTemplate MaxBounds',
        maxBoundsRegExp,
        { first: 'index' }
      ),
      this.#omegga.watchLogChunk(
        'GetAll BrickBuildingTemplate Center',
        centerRegExp,
        { first: 'index' }
      ),
    ]);

    if (
      !template.length ||
      !minBounds.length ||
      !maxBounds.length ||
      !centers.length
    )
      return;

    // get template name
    const templateName = template[0].groups.templateName;

    // find all values with matching template name
    const minBound = minBounds.find(
      minBound => minBound.groups.templateName === templateName
    );
    const maxBound = maxBounds.find(
      maxBound => maxBound.groups.templateName === templateName
    );
    const center = centers.find(
      center => center.groups.templateName === templateName
    );

    if (!minBound || !maxBound || !center) return;

    return {
      minBound: [+minBound.groups.x, +minBound.groups.y, +minBound.groups.z],
      maxBound: [+maxBound.groups.x, +maxBound.groups.y, +maxBound.groups.z],
      center: [+center.groups.x, +center.groups.y, +center.groups.z],
    };
  }

  /**
   * get bricks inside template bounds
   * @return {Promise<SaveData>} - BRS JS Save Data
   */
  async getTemplateBoundsData() {
    const templateBounds = await this.getTemplateBounds();

    if (!templateBounds) return;

    const saveData = await this.#omegga.getSaveData();

    if (!saveData) return;

    // filter bricks outside the bounds
    saveData.bricks = saveData.bricks.filter(brick => {
      return brickUtils.checkBounds(
        brick,
        saveData.brick_assets,
        templateBounds
      );
    });

    if (saveData.bricks.length > 0) {
      return saveData;
    }

    return undefined;
  }

  /**
   * load bricks at ghost brick location
   * @param  {SaveData} - player or player identifier
   * @param  {Number} - save load X offset
   * @param  {Number} - save load Y offset
   * @param  {Number} - save load Z offset
   * @param  {Boolean} - quiet mode
   * @return {Promise} - BRS JS Save Data
   */
  async loadDataAtGhostBrick(
    saveData,
    { rotate = true, offX = 0, offY = 0, offZ = 0, quiet = true } = {}
  ) {
    const ghostBrickData = await this.getGhostBrick();

    if (!ghostBrickData || !saveData) return;

    // get bounds of the bricks
    const bounds = brickUtils.getBounds(saveData);

    if (rotate) {
      const orientation =
        brickUtils.BRICK_CONSTANTS.orientationMap[ghostBrickData.orientation];
      saveData.bricks = saveData.bricks.map(brick =>
        brickUtils.rotate(brick, orientation)
      );
      // rotate bounds, if we dont use the original bounds they are off by 1 sometimes >:(
      bounds.minBound = brickUtils.BRICK_CONSTANTS.translationTable[
        brickUtils.d2o(...orientation)
      ](bounds.minBound);
      bounds.maxBound = brickUtils.BRICK_CONSTANTS.translationTable[
        brickUtils.d2o(...orientation)
      ](bounds.maxBound);
      bounds.center = brickUtils.BRICK_CONSTANTS.translationTable[
        brickUtils.d2o(...orientation)
      ](bounds.center);
    }

    // calculate offset from bricks center to ghost brick center
    const offset = bounds.center.map(
      (center, index) => ghostBrickData.location[index] - center
    );

    // load at offset location
    await this.#omegga.loadSaveData(saveData, {
      offX: offX + offset[0],
      offY: offY + offset[1],
      offZ: offZ + offset[2],
      quiet,
    });
  }
}

global.Player = Player;

module.exports = Player;
