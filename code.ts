// This shows the HTML page in "ui.html".
figma.showUI(__html__, {
  height: 400,
  width: 500,
});

type CssVariable = {
  name: string;
  value: string;
};

type CssVariables = {
  type: string;
  prefix?: string;
  variables: CssVariable[];
};

figma.ui.onmessage = (msg) => {
  switch (msg.type) {
    case "create-css": {
      const cssVariables = getCssVariables(msg.exportedVariables);
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

function getCssVariables(exportedVariables: string[]): CssVariables[] {
  return [
    ...(exportedVariables.includes("color")
      ? [
          {
            type: "COLOR",
            prefix: "color",
            variables: getColors(),
          },
        ]
      : []),
    ...(exportedVariables.includes("shadow")
      ? [
          {
            type: "SHADOW",
            prefix: "shadow",
            variables: getShadows(),
          },
        ]
      : []),
    ...(exportedVariables.includes("blur")
      ? [
          {
            type: "BLUR",
            prefix: "blur",
            variables: getBlurs(),
          },
        ]
      : []),
    ...(exportedVariables.includes("font-size")
      ? [
          {
            type: "FONT SIZE",
            prefix: "font-size",
            variables: getFontSizes(),
          },
        ]
      : []),
    ...(exportedVariables.includes("font-weight")
      ? [
          {
            type: "FONT WEIGHT",
            prefix: "font-weight",
            variables: getFontWeights(),
          },
        ]
      : []),
    ...(exportedVariables.includes("font-family")
      ? [
          {
            type: "FONT FAMILY",
            prefix: "font-family",
            variables: getFontFamilies(),
          },
        ]
      : []),
    ...(exportedVariables.includes("local-variables")
      ? [
          {
            type: "LOCAL VARIABLES",
            // TODO: should consider prefix for local variables
            prefix: "",
            variables: getLocalVariables(),
          },
        ]
      : []),
  ];
}

function getColors(): CssVariable[] {
  const paintStyles = figma.getLocalPaintStyles().filter((paintStyle) => {
    let color = paintStyle.paints[0] as SolidPaint;
    return color.type === "SOLID";
  });

  return paintStyles.map((paintStyle) => {
    const paint = paintStyle.paints[0] as SolidPaint;

    const hex = convertToColorCode({ ...paint.color, a: paint.opacity });
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
        }px ${convertToColorCode(effect.color)}`,
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

function getLocalVariables(): CssVariable[] {
  function extractValueFromValues(
    valuesByMode: Variable["valuesByMode"],
    variableName: string
  ): VariableValue {
    const values = Object.values(valuesByMode);
    if (values.length !== 1) {
      throw new Error(
        `Variable (${variableName}) has multiple values or no values`
      );
    }

    return values[0];
  }

  return figma.variables
    .getLocalVariables()
    .map((variable) => {
      const variableValue = extractValueFromValues(
        variable.valuesByMode,
        variable.name
      );

      switch (variable.resolvedType) {
        case "COLOR": {
          if (!isRGB(variableValue))
            throw new Error(`Variable (${variable.name}) value is not a color`);

          return {
            name: variable.name,
            value: convertToColorCode(variableValue),
          };
        }
        case "STRING": {
          if (typeof variableValue !== "string")
            throw new Error(
              `Variable (${variable.name}) value is not a string`
            );

          return { name: variable.name, value: variableValue };
        }
        case "FLOAT": {
          if (typeof variableValue !== "number")
            throw new Error(
              `Variable (${variable.name}) value is not a number`
            );

          return { name: variable.name, value: variableValue.toString() };
        }
        case "BOOLEAN": {
          // TODO: not supported yet
          console.warn("Boolean variable is not supported yet");
          return undefined;
        }
        default:
          const _: never = variable.resolvedType;
          return undefined;
      }
    })
    .filter(isNotUndefined);
}

function createCss(cssVariables: CssVariables[]): string {
  return cssVariables
    .map(({ prefix, type, variables }) => {
      const css = variables
        .map((variable) => {
          return convertToCssVariables(variable, prefix);
        })
        .join("\n");

      return `/* --- ${type} --- */\n${css}`;
    })
    .join("\n\n");
}

function isNotUndefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function isRGB(color: VariableValue): color is RGB {
  return (
    typeof color === "object" &&
    color !== null &&
    "r" in color &&
    "g" in color &&
    "b" in color
  );
}

function isRGBA(color: VariableValue): color is RGBA {
  return (
    typeof color === "object" &&
    color !== null &&
    "r" in color &&
    "g" in color &&
    "b" in color &&
    "a" in color
  );
}

const convertToHex = (value: number) => {
  const hex = Math.round(value * 255).toString(16);
  return hex.length === 1 ? `0${hex}` : hex;
};

const beautifyColor = (color: RGB | RGBA) => {
  return {
    r: convertToHex(color.r),
    g: convertToHex(color.g),
    b: convertToHex(color.b),
    a: isRGBA(color) ? convertToHex(color.a) : undefined,
  };
};

const convertToColorCode = (color: RGB | RGBA) => {
  const beautifiedColor = beautifyColor(color);

  return `#${beautifiedColor.r}${beautifiedColor.g}${beautifiedColor.b}${
    beautifiedColor.a !== undefined && beautifiedColor.a !== "ff"
      ? beautifiedColor.a
      : ""
  }`;
};

const normalizeCssVariableName = (name: string) => {
  return name.replace(/[\s//]/g, "-").toLowerCase();
};

const convertToCssVariables = (
  variable: CssVariable,
  prefix: string | undefined
) => {
  return `--${prefix ? `${prefix}-` : ""}${normalizeCssVariableName(
    variable.name
  )}: ${variable.value};`;
};
