// This shows the HTML page in "ui.html".
figma.showUI(__html__);

type CssVariable = {
  name: string;
  value: string;
};

type CssVariables = {
  prefix: string;
  variables: CssVariable[];
};

figma.ui.onmessage = (msg) => {
  switch (msg.type) {
    case "create-css": {
      const cssVariables = getCssVariables();
      const css = createCss(cssVariables);
      figma.ui.postMessage({ type: "generated", css });
      break;
    }
    case "cancel": {
      figma.closePlugin();
      break;
    }
  }
};

function getCssVariables(): CssVariables[] {
  return [
    {
      prefix: "color",
      variables: getColors(),
    },
    {
      prefix: "shadow",
      variables: getShadows(),
    },
    {
      prefix: "blur",
      variables: getBlurs(),
    },
    {
      prefix: "font-size",
      variables: getFontSizes(),
    },
    {
      prefix: "font-weight",
      variables: getFontWeights(),
    },
    {
      prefix: "font-family",
      variables: getFontFamilies(),
    },
  ];
}

function getColors(): CssVariable[] {
  const paintStyles = figma.getLocalPaintStyles().filter((paintStyle) => {
    let color = paintStyle.paints[0] as SolidPaint;
    return color.type === "SOLID";
  });

  return paintStyles.map((paintStyle) => {
    const paint = paintStyle.paints[0] as SolidPaint;

    const hex = convertToColorCode(paint.color, paint.opacity);
    return { name: paintStyle.name, value: hex };
  });
}

function getFontSizes(): CssVariable[] {
  const textStyles = figma.getLocalTextStyles();

  return textStyles.map((textStyle) => {
    return {
      name: textStyle.name,
      value: `${textStyle.fontSize.toString()}px`,
    };
  });
}

function getFontWeights(): CssVariable[] {
  const textStyles = figma.getLocalTextStyles();

  return textStyles.map((textStyle) => {
    return {
      name: textStyle.name,
      value: textStyle.fontName.style.toLowerCase(),
    };
  });
}

function getFontFamilies(): CssVariable[] {
  const textStyles = figma.getLocalTextStyles();

  return textStyles.map((textStyle) => {
    return {
      name: textStyle.name,
      value: textStyle.fontName.family,
    };
  });
}

function getShadows(): CssVariable[] {
  const effectStyles = figma.getLocalEffectStyles();

  return effectStyles
    .filter((effectStyle) => {
      const effect = effectStyle.effects[0];
      return effect.type === "DROP_SHADOW" || effect.type === "INNER_SHADOW";
    })
    .map((effectStyle) => {
      const effect = effectStyle.effects[0];

      if (effect.type !== "DROP_SHADOW" && effect.type !== "INNER_SHADOW") {
        return { name: "", value: "" };
      }

      return {
        name: effectStyle.name,
        value: `${effect.offset.x}px ${effect.offset.y}px ${
          effect.radius
        }px ${convertToColorCode(effect.color, undefined)}`,
      };
    });
}

function getBlurs(): CssVariable[] {
  const effectStyles = figma.getLocalEffectStyles();

  return effectStyles
    .filter((effectStyle) => {
      const effect = effectStyle.effects[0];
      return effect.type === "BACKGROUND_BLUR" || effect.type === "LAYER_BLUR";
    })
    .map((effectStyle) => {
      const effect = effectStyle.effects[0];

      if (effect.type !== "BACKGROUND_BLUR" && effect.type !== "LAYER_BLUR") {
        return { name: "", value: "" };
      }

      return {
        name: effectStyle.name,
        value: `blur(${effect.radius}px)`,
      };
    });
}

function createCss(cssVariables: CssVariables[]): string {
  return cssVariables
    .map(({ prefix, variables }) => {
      const css = variables
        .map((variable) => {
          return convertToCssVariables(variable, prefix);
        })
        .join("\n");

      return `/* --- ${prefix} --- */\n${css}`;
    })
    .join("\n\n");
}

const convertToHex = (value: number) => {
  const hex = Math.round(value * 255).toString(16);
  return hex.length === 1 ? `0${hex}` : hex;
};

const beautifyColor = (color: RGB) => {
  return {
    r: convertToHex(color.r),
    g: convertToHex(color.g),
    b: convertToHex(color.b),
  };
};

const beautifyOpacity = (opacity: number | undefined) => {
  return opacity ? opacity * 100 : 100;
};

const convertToColorCode = (color: RGB, opacity: number | undefined) => {
  const beautifiedColor = beautifyColor(color);
  const beautifiedOpacity = beautifyOpacity(opacity);

  return `#${beautifiedColor.r}${beautifiedColor.g}${beautifiedColor.b}${
    beautifiedOpacity === 100 ? "" : beautifiedOpacity
  }`;
};

const normalizeCssVariableName = (name: string) => {
  return name.replace(/[\s//]/g, "-").toLowerCase();
};

const convertToCssVariables = (variable: CssVariable, prefix: string) => {
  return `--${prefix}-${normalizeCssVariableName(variable.name)}: ${
    variable.value
  };`;
};
