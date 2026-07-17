export interface BadgeModel {
  label: string;
}

const React = {
  createElement(
    type: string,
    properties: Record<string, string>,
    child: string,
  ) {
    return { type, properties, child };
  },
};

export function Badge({
  label,
}: BadgeModel): ReturnType<typeof React.createElement> {
  return <strong data-kind="badge">{label}</strong>;
}
