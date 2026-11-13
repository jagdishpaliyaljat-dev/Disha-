import React, { useCallback, useMemo } from "react";
import { List, useDynamicRowHeight } from "react-window";
import { Question } from "../types";
import { ManageQuestionRow } from "./ManageQuestionRow";

interface RowExtraProps {
  questions: Question[];
  selectedQuestionIds: Set<string>;
  singleDeletingQuestionId: string | null;
  handleToggleSelectQuestion: (id: string) => void;
  setSingleDeletingQuestionId: (id: string | null) => void;
  setEditingQuestion: (q: Question) => void;
  setSelectedQuestionIds: (ids: Set<string>) => void;
  setShowBulkMoveModal: (show: boolean) => void;
  showNotification: (msg: string) => void;
  onDeleteQuestion: (id: string) => void;
}

function QuestionRowItem({
  ariaAttributes,
  index,
  style,
  questions,
  selectedQuestionIds,
  singleDeletingQuestionId,
  handleToggleSelectQuestion,
  setSingleDeletingQuestionId,
  setEditingQuestion,
  setSelectedQuestionIds,
  setShowBulkMoveModal,
  showNotification,
  onDeleteQuestion,
}: {
  ariaAttributes: {
    "aria-posinset": number;
    "aria-setsize": number;
    role: "listitem";
  };
  index: number;
  style: React.CSSProperties;
} & RowExtraProps): React.ReactElement | null {
  const q = questions[index];
  if (!q) return null;

  const isSelected = selectedQuestionIds.has(q.id);
  const isDeletingSingle = singleDeletingQuestionId === q.id;

  return (
    <div style={style} {...ariaAttributes} className="w-full pb-3.5">
      <ManageQuestionRow
        data={{
          q,
          idx: index,
          isSelected,
          isDeletingSingle,
          handleToggleSelectQuestion,
          setSingleDeletingQuestionId,
          setEditingQuestion,
          setSelectedQuestionIds,
          setShowBulkMoveModal,
          showNotification,
          onDeleteQuestion,
        }}
        style={{}}
      />
    </div>
  );
}

export interface VirtualizedQuestionListProps {
  questions: Question[];
  selectedQuestionIds: Set<string>;
  singleDeletingQuestionId: string | null;
  handleToggleSelectQuestion: (id: string) => void;
  setSingleDeletingQuestionId: (id: string | null) => void;
  setEditingQuestion: (q: Question) => void;
  setSelectedQuestionIds: (ids: Set<string>) => void;
  setShowBulkMoveModal: (show: boolean) => void;
  showNotification: (msg: string) => void;
  onDeleteQuestion: (id: string) => void;
  scrollElement?: HTMLElement | null;
  height?: number | string;
}

export const VirtualizedQuestionList: React.FC<VirtualizedQuestionListProps> = ({
  questions,
  selectedQuestionIds,
  singleDeletingQuestionId,
  handleToggleSelectQuestion,
  setSingleDeletingQuestionId,
  setEditingQuestion,
  setSelectedQuestionIds,
  setShowBulkMoveModal,
  showNotification,
  onDeleteQuestion,
  scrollElement,
  height = 600,
}) => {
  const dynamicRowHeight = useDynamicRowHeight({
    defaultRowHeight: 280,
    key: questions.length > 0 ? `${questions.length}-${questions[0]?.id}` : "empty",
  });

  const getRowKey = useCallback(
    (index: number, data: RowExtraProps) => {
      const q = data.questions[index];
      return q ? q.id : index;
    },
    []
  );

  const rowProps = useMemo<RowExtraProps>(
    () => ({
      questions,
      selectedQuestionIds,
      singleDeletingQuestionId,
      handleToggleSelectQuestion,
      setSingleDeletingQuestionId,
      setEditingQuestion,
      setSelectedQuestionIds,
      setShowBulkMoveModal,
      showNotification,
      onDeleteQuestion,
    }),
    [
      questions,
      selectedQuestionIds,
      singleDeletingQuestionId,
      handleToggleSelectQuestion,
      setSingleDeletingQuestionId,
      setEditingQuestion,
      setSelectedQuestionIds,
      setShowBulkMoveModal,
      showNotification,
      onDeleteQuestion,
    ]
  );

  if (questions.length === 0) {
    return null;
  }

  return (
    <List
      rowCount={questions.length}
      rowHeight={dynamicRowHeight}
      rowComponent={QuestionRowItem}
      rowProps={rowProps}
      rowKey={getRowKey}
      overscanCount={3}
      scrollElement={scrollElement ?? undefined}
      style={scrollElement ? undefined : { height, width: "100%" }}
    />
  );
};
