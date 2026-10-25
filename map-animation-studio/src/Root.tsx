import React from "react";
import { Composition, Folder } from "remotion";
import { FOLDERS, TEMPLATES } from "./registry";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {Object.keys(FOLDERS).map((folder) => (
        <Folder key={folder} name={folder}>
          {TEMPLATES.filter((t) => t.folder === folder).map((t) => (
            <Composition
              key={t.id}
              id={t.id}
              component={t.component}
              schema={t.schema}
              calculateMetadata={t.calculateMetadata}
              defaultProps={t.defaultProps}
              durationInFrames={300}
              fps={30}
              width={1920}
              height={1080}
            />
          ))}
        </Folder>
      ))}
    </>
  );
};
