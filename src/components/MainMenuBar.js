import React, { useMemo } from "react";
import * as Icons from "@material-ui/icons";
import { useSelector } from "react-redux";
import { useHistory } from "react-router-dom";
import { useModulesManager } from "../helpers/modules";
import MainMenuContribution from "./generics/MainMenuContribution";
import { Typography } from "@material-ui/core";
import { useTheme } from "@material-ui/core/styles";
import { useIntl } from "react-intl";

const DEFAULT_MENU_SECTIONS = [
  { titleKey: "core.menuSection.programasSociais", items: ["PrlMainMenu", "EducationalModuleMenu", "GrievanceMainMenu"] },
  { titleKey: "core.menuSection.operacoesFinanceiras", items: ["LegalAndFinanceMainMenu"] },
  { titleKey: "core.menuSection.monitorizacao", items: ["OpenSearchReportsMenu", "TasksMainMenu"] },
  { titleKey: "core.menuSection.administracao", items: ["AdminMainMenu", "ProfileMainMenu", "ParametrizacoesMenu"] },
];

function getMenus(modulesManager, key, rights, menuVariant) {
  const menus = modulesManager.getContribs(key);
  const menuConfig = modulesManager.getConf("fe-core", "menus", []);
  
  if (menuConfig?.length) {
    const unmatchedMenus = getUnmatchedMenus(menuConfig, menus, rights, modulesManager, menuVariant);
    let menuToProcess = [...menus, ...unmatchedMenus];
    menuToProcess = attachIcons(menuToProcess, menuConfig);
    const sortedMenus = sortMenus(menuToProcess, menuConfig);
    return processMenu(sortedMenus);
  }

  return processMenu(menus);
}

function attachIcons(menus, menuConfig) {
  return menus.map(menu => {
    const configMatch = menuConfig.find(config => config.id === menu.name);

    if (configMatch?.icon) {
      const IconComponent = Icons[configMatch.icon] ? Icons[configMatch.icon] : null;

      if (IconComponent) {
        return {
          ...menu,
          component: (props) => <menu.component {...props} icon={<IconComponent />} />
        };
      }
    }
    
    return menu;
  });
}

function getUnmatchedMenus(menuConfig, menus, rights, modulesManager, menuVariant) {
  const existingIds = menus
    .filter((menu) => typeof menu === 'object')
    .map((menu) => menu.name);
  const history = useHistory();

  const unmatchedConfigs = menuConfig.filter((config) => !existingIds.includes(config.id));

  return unmatchedConfigs
    .map((config) => {
      if (config.filter && !config.filter(rights)) {
        return null;
      }
      
      const IconComponent = config.icon && Icons[config.icon] ? Icons[config.icon] : null;

      return {
        name: config.id,
        component: () => (
          <MainMenuContribution
            menuVariant={menuVariant}
            header={config.name}
            menuId={config.id}
            modulesManager={modulesManager}
            rights={rights}
            history={history}
            entries={[]}
            icon={IconComponent ? <IconComponent /> : null}
          />
        ),
      };
    })
    .filter(Boolean);
}

function processMenu(menus) {
  return menus
    .map((menu) => {
      if (!menu) return null;
      if (typeof menu === 'object' && menu.component) {
        // menu.id comes from menuConfig merge and preserves the original contribution name
        return { name: menu.id || menu.name || null, component: menu.component };
      }
      return { name: null, component: menu };
    })
    .filter(Boolean);
};

function sortMenus(menus, menuConfig) {
  const filteredMenus = menus.filter((menu) => {
    const menuId = typeof menu === 'object' ? menu.name : menu;
    return menuConfig.some(config => config.id === menuId);
  });

  const updatedMenus = filteredMenus.map((menu) => {
    const menuId = typeof menu === 'object' ? menu.name : menu;
    const configMatch = menuConfig.find(config => config.id === menuId);
    if (configMatch && typeof menu === 'object') {
      return { ...menu, ...configMatch };
    }
    return menu;
  });
  return updatedMenus.sort((a, b) => a.position - b.position);
}

function groupMenusBySection(menusWithNames, sections) {
  const result = [];
  const assignedIndices = new Set();

  for (const section of sections) {
    const sectionMenus = [];
    for (const itemName of section.items) {
      const menuIdx = menusWithNames.findIndex((m, idx) => m.name === itemName && !assignedIndices.has(idx));
      if (menuIdx !== -1) {
        sectionMenus.push(menusWithNames[menuIdx]);
        assignedIndices.add(menuIdx);
      }
    }
    if (sectionMenus.length > 0) {
      result.push({ titleKey: section.titleKey, menus: sectionMenus });
    }
  }

  const uncategorized = menusWithNames.filter((_, idx) => !assignedIndices.has(idx));
  if (uncategorized.length > 0) {
    result.push({ titleKey: null, menus: uncategorized });
  }

  return result;
}

const MainMenuBar = ({ children = null, contributionKey, reverse = false, menuVariant, ...delegated }) => {
  const modulesManager = useModulesManager();
  const rights = useSelector((state) => state.core?.user?.i_user?.rights || []);
  const theme = useTheme();
  const intl = useIntl();
  const menuSections = modulesManager.getConf("fe-core", "menuSections", DEFAULT_MENU_SECTIONS);

  const components = useMemo(() => {
    const components = getMenus(modulesManager, contributionKey, rights, menuVariant);
    if (reverse) {
      components.reverse();
    }
    return components;
  }, [contributionKey, reverse, rights, menuVariant]);

  if (menuVariant === "Drawer" && menuSections?.length) {
    const sections = groupMenusBySection(components, menuSections);
    return (
      <>
        {children}
        {sections.map((section, sIdx) => (
          <React.Fragment key={`section_${sIdx}`}>
            {section.titleKey && (
              <Typography
                variant="overline"
                style={{
                  padding: '20px 16px 4px',
                  display: 'block',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '0.7rem',
                  letterSpacing: '0.08em',
                }}
              >
                {intl.formatMessage({ id: section.titleKey })}
              </Typography>
            )}
            {section.menus.map(({ component: Comp }, mIdx) => (
              <Comp key={`${contributionKey}_s${sIdx}_${mIdx}`} modulesManager={modulesManager} menuVariant={menuVariant} {...delegated} />
            ))}
          </React.Fragment>
        ))}
      </>
    );
  }

  return (
    <>
      {children}
      {components.map(({ component: Comp }, idx) => (
        <Comp key={`${contributionKey}_${idx}`} modulesManager={modulesManager} menuVariant={menuVariant} {...delegated} />
      ))}
    </>
  );
};

export default MainMenuBar;
