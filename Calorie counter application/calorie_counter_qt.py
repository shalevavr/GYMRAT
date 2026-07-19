import math
import re
import sys
import traceback
from datetime import date, timedelta
from html import escape

from PySide6.QtCore import QObject, QRunnable, Qt, QThreadPool, Signal
from PySide6.QtGui import QColor, QFont, QPainter, QTextBlockFormat, QTextCursor, QTextOption
from PySide6.QtWidgets import (
    QApplication,
    QButtonGroup,
    QFrame,
    QHBoxLayout,
    QHeaderView,
    QLabel,
    QLineEdit,
    QMainWindow,
    QMessageBox,
    QPushButton,
    QProgressBar,
    QRadioButton,
    QSizePolicy,
    QTableWidget,
    QTableWidgetItem,
    QTextEdit,
    QVBoxLayout,
    QWidget,
)

import calorie_counter_he as core


class HebrewFoodEditor(QTextEdit):
    def __init__(self) -> None:
        super().__init__()
        self.setAcceptRichText(False)
        self.setLayoutDirection(Qt.LeftToRight)
        self.viewport().setLayoutDirection(Qt.LeftToRight)
        self.setStyleSheet("QTextEdit { text-align: right; }")
        self.setMinimumHeight(170)
        self.setPlaceholderText("• קפה\n• יוגורט + גרנולה\n• חביתה, סלט")
        option = self.document().defaultTextOption()
        option.setTextDirection(Qt.RightToLeft)
        option.setAlignment(Qt.AlignRight)
        option.setWrapMode(QTextOption.WordWrap)
        self.document().setDefaultTextOption(option)
        self.apply_rtl_format()

    def apply_rtl_format(self) -> None:
        cursor = self.textCursor()
        anchor = cursor.anchor()
        position = cursor.position()
        block_format = QTextBlockFormat()
        block_format.setLayoutDirection(Qt.RightToLeft)
        block_format.setAlignment(Qt.AlignRight)
        cursor.mergeBlockFormat(block_format)
        self.setAlignment(Qt.AlignRight)
        cursor.setPosition(anchor)
        cursor.setPosition(position, QTextCursor.KeepAnchor if anchor != position else QTextCursor.MoveAnchor)
        self.setTextCursor(cursor)

    def apply_rtl_to_document(self) -> None:
        cursor = self.textCursor()
        anchor = cursor.anchor()
        position = cursor.position()
        formatter = QTextCursor(self.document())
        formatter.select(QTextCursor.Document)
        block_format = QTextBlockFormat()
        block_format.setLayoutDirection(Qt.RightToLeft)
        block_format.setAlignment(Qt.AlignRight)
        formatter.mergeBlockFormat(block_format)
        self.setAlignment(Qt.AlignRight)
        cursor.setPosition(anchor)
        cursor.setPosition(position, QTextCursor.KeepAnchor if anchor != position else QTextCursor.MoveAnchor)
        self.setTextCursor(cursor)

    def setPlainText(self, text: str) -> None:
        super().setPlainText(text)
        self.apply_rtl_to_document()

    def keyPressEvent(self, event) -> None:
        self.apply_rtl_format()
        if event.key() in (Qt.Key_Return, Qt.Key_Enter):
            cursor = self.textCursor()
            current_line = cursor.block().text().strip()
            if current_line and not current_line.startswith("•"):
                cursor.movePosition(QTextCursor.StartOfBlock)
                cursor.insertText("• ")
                cursor.movePosition(QTextCursor.EndOfBlock)
                self.setTextCursor(cursor)
            self.textCursor().insertText("\n• ")
            self.apply_rtl_format()
            return
        super().keyPressEvent(event)
        self.apply_rtl_format()

    def insertFromMimeData(self, source) -> None:
        super().insertFromMimeData(source)
        self.apply_rtl_to_document()

    def focusInEvent(self, event) -> None:
        super().focusInEvent(event)
        if not self.textCursor().hasSelection():
            self.apply_rtl_format()


class WorkerSignals(QObject):
    finished = Signal(str, dict)
    error = Signal(str, str)


class RecipeSignals(QObject):
    finished = Signal(dict)
    error = Signal(str, str)


class RecalculateSignals(QObject):
    finished = Signal(list)
    error = Signal(str, str)


class SaveWorker(QRunnable):
    def __init__(self, date_text: str, food_text: str, existing_created_at: str | None) -> None:
        super().__init__()
        self.date_text = date_text
        self.food_text = food_text
        self.existing_created_at = existing_created_at
        self.signals = WorkerSignals()

    def run(self) -> None:
        try:
            record = core.create_record(self.date_text, self.food_text, self.existing_created_at)
        except Exception as exc:
            self.signals.error.emit(str(exc), traceback.format_exc())
            return
        self.signals.finished.emit(self.date_text, record)


class RecipeWorker(QRunnable):
    def __init__(self, recent_recipes: list) -> None:
        super().__init__()
        self.recent_recipes = recent_recipes
        self.signals = RecipeSignals()

    def run(self) -> None:
        try:
            recipe = core.generate_lunch_recipe_tip_with_api(self.recent_recipes)
        except Exception as exc:
            self.signals.error.emit(str(exc), traceback.format_exc())
            return
        self.signals.finished.emit(recipe)


class RecalculateWorker(QRunnable):
    def __init__(self, records: list[dict]) -> None:
        super().__init__()
        self.records = records
        self.signals = RecalculateSignals()

    def run(self) -> None:
        try:
            records = core.recalculate_records_with_api(self.records)
        except Exception as exc:
            self.signals.error.emit(str(exc), traceback.format_exc())
            return
        self.signals.finished.emit(records)


class CalorieGraph(QWidget):
    def __init__(self, values_provider) -> None:
        super().__init__()
        self.values_provider = values_provider
        self.setMinimumHeight(260)
        self.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)

    def paintEvent(self, _event) -> None:
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)
        rect = self.rect().adjusted(46, 20, -20, -42)
        values = self.values_provider()
        if not values:
            return

        painter.fillRect(self.rect(), QColor("#ffffff"))
        painter.setPen(QColor("#e5e5ea"))
        painter.drawRoundedRect(rect, 8, 8)

        max_value = max([value for _label, value in values] + [0])
        max_axis = max(500, int(math.ceil((max_value + 500) / 500) * 500))
        target_y = rect.bottom() - (core.DAILY_CALORIE_TARGET / max_axis) * rect.height()

        if core.DAILY_CALORIE_TARGET <= max_axis:
            painter.setPen(QColor("#ff3b30"))
            painter.drawLine(rect.left(), int(target_y), rect.right(), int(target_y))
            painter.setFont(QFont("Segoe UI", 9, QFont.Bold))
            painter.drawText(rect.right() - 90, int(target_y) - 18, 88, 18, Qt.AlignRight, "יעד 2,100")

        gap = 5
        slot = rect.width() / max(1, len(values))
        bar_width = max(7, slot - gap)
        painter.setFont(QFont("Segoe UI", 8))
        for index, (label, value) in enumerate(values):
            x0 = rect.left() + index * slot + gap / 2
            bar_h = (value / max_axis) * rect.height() if max_axis else 0
            y0 = rect.bottom() - bar_h
            color = QColor("#007aff" if value <= core.DAILY_CALORIE_TARGET else "#ff9500")
            if value == 0:
                color = QColor("#e5e5ea")
            painter.fillRect(int(x0), int(y0), int(bar_width), int(bar_h), color)
            painter.setPen(QColor("#1d1d1f"))
            if value:
                painter.drawText(int(x0 - 20), int(y0 - 20), int(bar_width + 40), 16, Qt.AlignCenter, core.number_format(value))
            painter.setPen(QColor("#6e6e73"))
            if len(values) <= 12 or index % max(1, len(values) // 8) == 0:
                painter.drawText(int(x0 - 15), rect.bottom() + 8, int(bar_width + 30), 18, Qt.AlignCenter, label)

        painter.setPen(QColor("#d2d2d7"))
        for tick in range(0, max_axis + 1, 500):
            y = rect.bottom() - (tick / max_axis) * rect.height()
            painter.drawLine(rect.left() - 4, int(y), rect.left(), int(y))
            painter.setPen(QColor("#6e6e73"))
            painter.drawText(0, int(y) - 8, rect.left() - 8, 16, Qt.AlignRight, core.number_format(tick))
            painter.setPen(QColor("#d2d2d7"))


class CalorieCounterQt(QMainWindow):
    def __init__(self) -> None:
        super().__init__()
        self.state = core.load_state()
        self.thread_pool = QThreadPool.globalInstance()
        self.setWindowTitle("מונה קלוריות יומי")
        self.resize(1120, 780)
        self.setMinimumSize(980, 680)

        self.date_group = QButtonGroup(self)
        self.custom_date = QLineEdit()
        self.food_text = HebrewFoodEditor()
        self.result = QLabel("בחר תאריך, כתוב מה אכלת ושמור את הרשומה.")
        self.items_table = QTableWidget(0, 5)
        self.records_table = QTableWidget(0, 8)
        self.period_group = QButtonGroup(self)
        self.busy = QProgressBar()
        self.graph = CalorieGraph(self.graph_values)
        self.current_recipe: dict | None = None
        self.recipe_busy = QProgressBar()
        self.recipe_summary = QLabel("לחץ על יצירת הצעה כדי לקבל רעיון לצהריים משביעים וקלים קלורית.")
        self.recipe_details = QTextEdit()
        self.recipe_more_button = QPushButton("⌄ הצג עוד")
        self.recipe_generate_button = QPushButton("צור הצעת צהריים")
        self.recipe_another_button = QPushButton("הצעה אחרת")
        self.recipe_save_button = QPushButton("שמור לקובץ")
        self.recalculate_all_button = QPushButton("recalculate all")
        self.recalculate_busy = QProgressBar()

        self.build_ui()
        self.refresh_all()

    def build_ui(self) -> None:
        self.setStyleSheet(
            """
            QMainWindow, QWidget { background: #f5f5f7; color: #1d1d1f; font-family: "Segoe UI"; font-size: 12px; }
            QFrame[card="true"] { background: white; border-radius: 14px; }
            QLabel#title { font-size: 26px; font-weight: 700; }
            QLabel#subtitle, QLabel#hint { color: #6e6e73; }
            QLabel#section { background: white; font-size: 13px; font-weight: 700; }
            QTextEdit, QLineEdit { background: #fbfbfd; border: 1px solid #d2d2d7; border-radius: 9px; padding: 8px; selection-background-color: #cfe8ff; }
            QTextEdit:focus, QLineEdit:focus { border-color: #007aff; }
            QPushButton { background: #e9e9eb; border: 0; border-radius: 9px; padding: 8px 14px; }
            QPushButton:hover { background: #dedee3; }
            QPushButton:disabled { color: #9b9ba1; }
            QPushButton#primary { background: #007aff; color: white; font-weight: 700; padding: 9px 16px; }
            QPushButton#primary:hover { background: #006edb; }
            QPushButton#danger { background: #ff3b30; color: white; }
            QPushButton#danger:hover { background: #d70015; }
            QPushButton#icon { font-size: 18px; padding: 4px 12px; }
            QLabel#recipeSummary { background: #fbfbfd; border: 1px solid #e5e5ea; border-radius: 10px; padding: 10px; }
            QTextEdit#recipeDetails { background: #fbfbfd; border: 1px solid #e5e5ea; border-radius: 10px; padding: 12px; }
            QRadioButton { background: white; padding: 4px 8px; spacing: 8px; }
            QRadioButton::indicator { width: 16px; height: 16px; border: 1px solid #1d1d1f; border-radius: 8px; background: white; }
            QRadioButton::indicator:checked { background: qradialgradient(cx:0.5, cy:0.5, radius:0.55, fx:0.5, fy:0.5, stop:0 #1d1d1f, stop:0.43 #1d1d1f, stop:0.47 white, stop:1 white); border: 1px solid #1d1d1f; }
            QTableWidget { background: white; border: 0; gridline-color: #e5e5ea; selection-background-color: #dbeafe; }
            QHeaderView::section { background: #f5f5f7; color: #6e6e73; border: 0; padding: 7px; font-weight: 700; }
            QProgressBar { border: 0; background: transparent; max-height: 10px; }
            QProgressBar::chunk { background: #007aff; border-radius: 5px; }
            """
        )

        root = QWidget()
        root.setLayoutDirection(Qt.LeftToRight)
        self.setCentralWidget(root)
        shell = QVBoxLayout(root)
        shell.setContentsMargins(22, 22, 22, 22)
        shell.setSpacing(16)

        title = QLabel("מונה קלוריות יומי")
        title.setObjectName("title")
        title.setAlignment(Qt.AlignRight)
        subtitle = QLabel("יעד יומי קבוע: 2,100 קלוריות")
        subtitle.setObjectName("subtitle")
        subtitle.setAlignment(Qt.AlignRight)
        shell.addWidget(title)
        shell.addWidget(subtitle)

        main = QHBoxLayout()
        main.setDirection(QHBoxLayout.LeftToRight)
        main.setSpacing(20)
        shell.addLayout(main, 1)

        dashboard = self.card()
        form = self.card()
        dashboard.setObjectName("dashboardCard")
        form.setObjectName("formCard")
        dashboard.setLayoutDirection(Qt.RightToLeft)
        form.setLayoutDirection(Qt.RightToLeft)
        main.addWidget(dashboard, 1)
        main.addWidget(form, 1)

        self.build_dashboard(dashboard)
        self.build_form(form)

    def card(self) -> QFrame:
        frame = QFrame()
        frame.setProperty("card", True)
        frame.setFrameShape(QFrame.NoFrame)
        layout = QVBoxLayout(frame)
        layout.setContentsMargins(20, 20, 20, 20)
        layout.setSpacing(12)
        return frame

    def section_label(self, text: str) -> QLabel:
        label = QLabel(text)
        label.setObjectName("section")
        label.setAlignment(Qt.AlignRight)
        return label

    def build_form(self, form: QFrame) -> None:
        layout = form.layout()
        layout.addWidget(self.section_label("לאיזה תאריך תרצה לרשום את האכילה?"))
        date_row = QHBoxLayout()
        date_row.setDirection(QHBoxLayout.LeftToRight)
        date_row.setSpacing(18)
        date_row.addStretch(1)
        for index, text in enumerate(("היום", "אתמול", "מותאם אישית")):
            button = QRadioButton(text)
            button.setLayoutDirection(Qt.RightToLeft)
            self.date_group.addButton(button, index)
            date_row.addWidget(button)
            if index == 0:
                button.setChecked(True)
        self.date_group.buttonClicked.connect(self.update_custom_date_state)
        layout.addLayout(date_row)

        self.custom_date.setLayoutDirection(Qt.RightToLeft)
        self.custom_date.setAlignment(Qt.AlignRight)
        self.custom_date.setEnabled(False)
        layout.addWidget(self.custom_date)
        hint = QLabel("בתאריך מותאם אפשר לכתוב 5/6 או 05/06/2026")
        hint.setObjectName("hint")
        hint.setAlignment(Qt.AlignRight)
        layout.addWidget(hint)

        food_title = QHBoxLayout()
        food_title.setDirection(QHBoxLayout.RightToLeft)
        food_title.addWidget(self.section_label("מה אכלת היום?"))
        self.start_new_button = QPushButton("התחל חדש")
        food_title.addWidget(self.start_new_button)
        food_title.addStretch(1)
        layout.addLayout(food_title)
        layout.addWidget(self.food_text)

        actions = QHBoxLayout()
        actions.setDirection(QHBoxLayout.RightToLeft)
        self.save_button = QPushButton("שמור / עדכן רשומה")
        self.save_button.setObjectName("primary")
        self.delete_button = QPushButton("מחק רשומה")
        self.delete_button.setObjectName("danger")
        self.clear_button = QPushButton("נקה שדות")
        actions.addWidget(self.save_button)
        actions.addWidget(self.delete_button)
        actions.addWidget(self.clear_button)
        self.busy.setRange(0, 0)
        self.busy.setFixedWidth(80)
        self.busy.hide()
        actions.addWidget(self.busy)
        actions.addStretch(1)
        layout.addLayout(actions)

        self.save_button.clicked.connect(self.save_record)
        self.delete_button.clicked.connect(self.delete_record)
        self.clear_button.clicked.connect(self.clear_form)
        self.start_new_button.clicked.connect(self.start_new_record)

        self.result.setWordWrap(True)
        self.result.setAlignment(Qt.AlignRight)
        self.result.setLayoutDirection(Qt.RightToLeft)
        layout.addWidget(self.result)

        layout.addWidget(self.section_label("פירוט הערכה"))
        self.setup_table(self.items_table, ("פריט", "קלוריות (Kcal)", "חלבונים (גרם)", "פחמימות (גרם)", "שומנים (גרם)"))
        layout.addWidget(self.items_table, 1)

    def build_dashboard(self, dashboard: QFrame) -> None:
        layout = dashboard.layout()
        top = QHBoxLayout()
        top.setDirection(QHBoxLayout.RightToLeft)
        refresh = QPushButton("↻")
        refresh.setObjectName("icon")
        refresh.clicked.connect(self.refresh_all)
        top.addWidget(refresh)
        self.recalculate_all_button.clicked.connect(self.recalculate_all_records)
        top.addWidget(self.recalculate_all_button)
        self.recalculate_busy.setRange(0, 0)
        self.recalculate_busy.setFixedWidth(80)
        self.recalculate_busy.hide()
        top.addWidget(self.recalculate_busy)
        top.addStretch(1)
        layout.addLayout(top)

        self.build_recipe_section(layout)

        controls = QHBoxLayout()
        controls.setDirection(QHBoxLayout.RightToLeft)
        controls.setSpacing(18)
        controls.addWidget(self.section_label("גרף צריכת קלוריות"))
        for index, (label, value) in enumerate((("שבוע", "week"), ("חודש", "month"), ("שנה", "year"))):
            button = QRadioButton(label)
            button.setLayoutDirection(Qt.RightToLeft)
            button.setProperty("period", value)
            self.period_group.addButton(button, index)
            controls.addWidget(button)
            if value == "week":
                button.setChecked(True)
        self.period_group.buttonClicked.connect(lambda _button: self.graph.update())
        controls.addStretch(1)
        layout.addLayout(controls)
        layout.addWidget(self.graph, 1)
        layout.addWidget(self.section_label("סיכום לפי ימים"))
        self.setup_table(
            self.records_table,
            ("עודכן", "מצב", "פער מהיעד (Kcal)", "צריכה (Kcal)", "חלבונים (גרם)", "פחמימות (גרם)", "שומנים (גרם)", "תאריך"),
        )
        self.records_table.itemSelectionChanged.connect(self.load_selected_record)
        layout.addWidget(self.records_table, 1)
        note = QLabel(f"קובץ נתונים: {core.STORAGE_PATH.name}")
        note.setObjectName("hint")
        note.setAlignment(Qt.AlignRight)
        layout.addWidget(note)

    def build_recipe_section(self, layout: QVBoxLayout) -> None:
        layout.addWidget(self.section_label("הצעת צהריים יומית"))

        recipe_actions = QHBoxLayout()
        recipe_actions.setDirection(QHBoxLayout.RightToLeft)
        self.recipe_generate_button.setObjectName("primary")
        self.recipe_another_button.setEnabled(False)
        self.recipe_save_button.setEnabled(False)
        self.recipe_more_button.setEnabled(False)
        recipe_actions.addWidget(self.recipe_generate_button)
        recipe_actions.addWidget(self.recipe_another_button)
        recipe_actions.addWidget(self.recipe_more_button)
        recipe_actions.addWidget(self.recipe_save_button)
        self.recipe_busy.setRange(0, 0)
        self.recipe_busy.setFixedWidth(80)
        self.recipe_busy.hide()
        recipe_actions.addWidget(self.recipe_busy)
        recipe_actions.addStretch(1)
        layout.addLayout(recipe_actions)

        self.recipe_summary.setObjectName("recipeSummary")
        self.recipe_summary.setWordWrap(True)
        self.recipe_summary.setAlignment(Qt.AlignRight)
        self.recipe_summary.setLayoutDirection(Qt.RightToLeft)
        layout.addWidget(self.recipe_summary)

        self.recipe_details.setObjectName("recipeDetails")
        self.recipe_details.setReadOnly(True)
        self.recipe_details.setMinimumHeight(260)
        self.recipe_details.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)
        self.recipe_details.setLineWrapMode(QTextEdit.WidgetWidth)
        self.recipe_details.setAlignment(Qt.AlignRight)
        self.recipe_details.setLayoutDirection(Qt.RightToLeft)
        self.recipe_details.hide()
        layout.addWidget(self.recipe_details)

        self.recipe_generate_button.clicked.connect(self.generate_recipe_tip)
        self.recipe_another_button.clicked.connect(self.generate_recipe_tip)
        self.recipe_more_button.clicked.connect(self.toggle_recipe_details)
        self.recipe_save_button.clicked.connect(self.save_recipe_to_file)

    def setup_table(self, table: QTableWidget, headers: tuple[str, ...]) -> None:
        table.setColumnCount(len(headers))
        table.setHorizontalHeaderLabels(headers)
        table.verticalHeader().setVisible(False)
        table.setAlternatingRowColors(False)
        table.setSelectionBehavior(QTableWidget.SelectRows)
        table.setEditTriggers(QTableWidget.NoEditTriggers)
        table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        table.setLayoutDirection(Qt.RightToLeft)

    def set_recipe_loading(self, loading: bool) -> None:
        self.recipe_busy.setVisible(loading)
        self.recipe_generate_button.setEnabled(not loading)
        self.recipe_another_button.setEnabled(bool(self.current_recipe) and not loading)
        self.recipe_save_button.setEnabled(bool(self.current_recipe) and not loading)
        self.recipe_more_button.setEnabled(bool(self.current_recipe) and not loading)

    def set_recalculate_loading(self, loading: bool) -> None:
        self.recalculate_busy.setVisible(loading)
        self.recalculate_all_button.setEnabled(not loading)
        self.setCursor(Qt.WaitCursor if loading else Qt.ArrowCursor)

    def recalculate_all_records(self) -> None:
        records = self.records()
        if not records:
            QMessageBox.information(self, "אין רשומות", "אין רשומות לחישוב מחדש.")
            return
        if QMessageBox.question(
            self,
            "חישוב מחדש",
            "לחשב מחדש את כל הרשומות בקריאת API אחת?\nהרשומות יישמרו רק אם כל התאריכים יחזרו תקינים.",
        ) != QMessageBox.StandardButton.Yes:
            return
        worker = RecalculateWorker(records)
        worker.signals.finished.connect(self.finish_recalculate_success)
        worker.signals.error.connect(self.finish_recalculate_error)
        self.result.setText("מחשב מחדש את כל הרשומות מול ה-API...")
        self.set_recalculate_loading(True)
        self.thread_pool.start(worker)

    def finish_recalculate_error(self, message: str, _traceback: str) -> None:
        self.set_recalculate_loading(False)
        QMessageBox.critical(self, "שגיאת API", message)

    def finish_recalculate_success(self, records: list) -> None:
        self.set_recalculate_loading(False)
        self.state["recordsByDate"] = {record["date"]: record for record in records}
        core.save_state(self.state)
        self.refresh_all()
        self.items_table.setRowCount(0)
        self.result.setText(f"החישוב מחדש הסתיים ונשמר עבור {len(records)} רשומות.")

    def generate_recipe_tip(self) -> None:
        self.recipe_summary.setText("יוצר הצעת צהריים חדשה...")
        self.recipe_details.hide()
        self.recipe_more_button.setText("⌄ הצג עוד")
        self.set_recipe_loading(True)
        worker = RecipeWorker(self.state.get("recipeHistory", [])[-8:])
        worker.signals.finished.connect(self.finish_recipe_success)
        worker.signals.error.connect(self.finish_recipe_error)
        self.thread_pool.start(worker)

    def finish_recipe_error(self, message: str, _traceback: str) -> None:
        self.set_recipe_loading(False)
        self.recipe_summary.setText("לא הצלחתי ליצור הצעה כרגע.")
        QMessageBox.critical(self, "שגיאת API", message)

    def finish_recipe_success(self, recipe: dict) -> None:
        self.current_recipe = recipe
        self.remember_recipe(recipe)
        self.recipe_summary.setText(self.recipe_summary_text(recipe))
        self.recipe_details.setHtml(self.recipe_details_html(recipe))
        self.recipe_details.hide()
        self.recipe_more_button.setText("⌄ הצג עוד")
        self.set_recipe_loading(False)

    def remember_recipe(self, recipe: dict) -> None:
        history = self.state.setdefault("recipeHistory", [])
        history.append(
            {
                "dish_name": recipe.get("dish_name", ""),
                "style": recipe.get("style", ""),
                "calories": recipe.get("calories", 0),
            }
        )
        self.state["recipeHistory"] = history[-12:]
        core.save_state(self.state)

    def recipe_summary_text(self, recipe: dict) -> str:
        return (
            f"{recipe['dish_name']} | {core.number_format(recipe['calories'])} קלוריות\n"
            f"חלבון: {recipe['protein_g']} ג׳ | שומנים: {recipe['fat_g']} ג׳ | פחמימות: {recipe['carbs_g']} ג׳\n"
            f"זמן עבודה: עד {recipe['active_prep_minutes']} דקות | סגנון: {recipe['style']}\n"
            f"{recipe['short_reason']}"
        )

    def recipe_details_html(self, recipe: dict) -> str:
        ingredients = "".join(f"<li>{escape(item)}</li>" for item in recipe["ingredients"])
        preparation = "".join(f"<li>{escape(step)}</li>" for step in recipe["preparation"])
        notes = escape(recipe.get("notes", ""))
        return (
            "<div dir='rtl' style='text-align:right;'>"
            f"<p><b>מצרכים</b></p><ul>{ingredients}</ul>"
            f"<p><b>איך להכין</b></p><ol>{preparation}</ol>"
            f"<p><b>הערות</b><br>{notes}</p>"
            "</div>"
        )

    def recipe_file_text(self, recipe: dict) -> str:
        ingredients = "\n".join(f"- {item}" for item in recipe["ingredients"])
        preparation = "\n".join(f"{index}. {step}" for index, step in enumerate(recipe["preparation"], start=1))
        return (
            f"{recipe['dish_name']}\n"
            f"קלוריות: {core.number_format(recipe['calories'])}\n"
            f"חלבון: {recipe['protein_g']} ג׳\n"
            f"שומנים: {recipe['fat_g']} ג׳\n"
            f"פחמימות: {recipe['carbs_g']} ג׳\n"
            f"זמן עבודה: עד {recipe['active_prep_minutes']} דקות\n"
            f"סגנון: {recipe['style']}\n"
            f"למה זה מתאים: {recipe['short_reason']}\n\n"
            "מצרכים\n"
            f"{ingredients}\n\n"
            "איך להכין\n"
            f"{preparation}\n\n"
            "הערות\n"
            f"{recipe.get('notes', '')}\n"
        )

    def safe_recipe_filename(self, dish_name: str) -> str:
        cleaned = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "", dish_name).strip()
        cleaned = re.sub(r"\s+", " ", cleaned)
        return (cleaned or "הצעת צהריים")[:80] + ".txt"

    def save_recipe_to_file(self) -> None:
        if not self.current_recipe:
            return
        path = core.app_directory() / self.safe_recipe_filename(self.current_recipe["dish_name"])
        path.write_text(self.recipe_file_text(self.current_recipe), encoding="utf-8")
        QMessageBox.information(self, "המתכון נשמר", f"המתכון נשמר בקובץ:\n{path.name}")

    def toggle_recipe_details(self) -> None:
        if not self.current_recipe:
            return
        visible = not self.recipe_details.isVisible()
        self.recipe_details.setVisible(visible)
        self.recipe_more_button.setText("⌃ הסתר" if visible else "⌄ הצג עוד")

    def update_custom_date_state(self, *_args) -> None:
        is_custom = self.date_group.checkedButton().text() == "מותאם אישית"
        self.custom_date.setEnabled(is_custom)
        if is_custom:
            self.custom_date.setFocus()

    def selected_date_text(self) -> str | None:
        choice = self.date_group.checkedButton().text()
        raw = self.custom_date.text() if choice == "מותאם אישית" else choice
        parsed = core.parse_date_text(raw)
        if parsed is None:
            QMessageBox.critical(self, "תאריך לא תקין", "לא הצלחתי לזהות את התאריך. כתוב בבקשה בפורמט יום/חודש או יום/חודש/שנה.")
            return None
        return core.format_date(parsed)

    def records(self) -> list[dict]:
        return list(self.state.get("recordsByDate", {}).values())

    def get_food_text(self) -> str:
        return core.remove_trailing_empty_bullets(self.food_text.toPlainText())

    def set_food_text(self, value: str) -> None:
        self.food_text.setPlainText(value)
        self.food_text.setAlignment(Qt.AlignRight)

    def set_loading(self, loading: bool) -> None:
        self.busy.setVisible(loading)
        for button in (self.save_button, self.delete_button, self.clear_button, self.start_new_button):
            button.setEnabled(not loading)
        self.setCursor(Qt.WaitCursor if loading else Qt.ArrowCursor)

    def save_record(self) -> None:
        date_text = self.selected_date_text()
        if not date_text:
            return
        food = self.get_food_text()
        if not food:
            QMessageBox.warning(self, "חסר תיאור אוכל", "כתוב בבקשה מה אכלת.")
            return
        existing = self.state["recordsByDate"].get(date_text)
        worker = SaveWorker(date_text, food, existing.get("createdAt") if existing else None)
        worker.signals.finished.connect(self.finish_save_success)
        worker.signals.error.connect(self.finish_save_error)
        self.result.setText("בודק מול ה-API...")
        self.set_loading(True)
        self.thread_pool.start(worker)

    def finish_save_error(self, message: str, _traceback: str) -> None:
        self.set_loading(False)
        QMessageBox.critical(self, "שגיאת API", message)

    def finish_save_success(self, date_text: str, record: dict) -> None:
        self.set_loading(False)
        self.state["recordsByDate"][date_text] = record
        core.save_state(self.state)
        self.show_record_result(record)
        self.refresh_all()

    def delete_record(self) -> None:
        date_text = self.selected_date_text()
        if not date_text:
            return
        if date_text not in self.state["recordsByDate"]:
            QMessageBox.information(self, "אין רשומה", f"לא מצאתי רשומה עבור {date_text}.")
            return
        if QMessageBox.question(self, "אישור מחיקה", f"למחוק את הרשומה של {date_text}?") != QMessageBox.StandardButton.Yes:
            return
        del self.state["recordsByDate"][date_text]
        core.save_state(self.state)
        self.result.setText(f"הרשומה של {date_text} נמחקה.\nהממוצע השבועי עודכן.")
        self.items_table.setRowCount(0)
        self.refresh_all()

    def clear_form(self) -> None:
        self.food_text.clear()
        self.custom_date.clear()
        self.date_group.button(0).setChecked(True)
        self.update_custom_date_state()
        self.result.setText("בחר תאריך, כתוב מה אכלת ושמור את הרשומה.")
        self.items_table.setRowCount(0)

    def start_new_record(self) -> None:
        date_text = self.selected_date_text()
        if not date_text:
            return
        self.food_text.clear()
        self.items_table.setRowCount(0)
        self.result.setText(f"רשומה חדשה עבור {date_text}. הרשומות השמורות לא השתנו.")

    def show_record_result(self, record: dict) -> None:
        items = record.get("estimatedItems", [])
        self.items_table.setRowCount(len(items) + 1)
        for row, item in enumerate(items):
            values = (
                item["name"],
                core.number_format(item["estimatedCalories"]),
                core.number_format(core.macro_value(item, "proteinGrams")),
                core.number_format(core.macro_value(item, "carbsGrams")),
                core.number_format(core.macro_value(item, "fatGrams")),
            )
            for col, value in enumerate(values):
                cell = QTableWidgetItem(str(value))
                cell.setTextAlignment((Qt.AlignRight if col == 0 else Qt.AlignCenter) | Qt.AlignVCenter)
                self.items_table.setItem(row, col, cell)
        total_row = len(items)
        totals = (
            "סה״כ",
            core.number_format(record["caloriesConsumed"]),
            core.number_format(core.macro_value(record, "proteinGrams")),
            core.number_format(core.macro_value(record, "carbsGrams")),
            core.number_format(core.macro_value(record, "fatGrams")),
        )
        for col, value in enumerate(totals):
            cell = QTableWidgetItem(str(value))
            cell.setFont(QFont("Segoe UI", 10, QFont.Bold))
            cell.setTextAlignment((Qt.AlignRight if col == 0 else Qt.AlignCenter) | Qt.AlignVCenter)
            self.items_table.setItem(total_row, col, cell)
        trend = core.weekly_trend(self.records(), record["date"])
        self.result.setText(core.record_message(record, trend))

    def refresh_all(self) -> None:
        self.refresh_table()
        self.graph.update()

    def refresh_table(self) -> None:
        records = sorted(self.records(), key=lambda item: core.parse_storage_date(item["date"]), reverse=True)
        self.records_table.setRowCount(len(records))
        for row, record in enumerate(records):
            values = (
                record.get("updatedAt", ""),
                core.hebrew_status(record["difference"]),
                core.number_format(record["difference"]),
                core.number_format(record["caloriesConsumed"]),
                core.number_format(core.macro_value(record, "proteinGrams")),
                core.number_format(core.macro_value(record, "carbsGrams")),
                core.number_format(core.macro_value(record, "fatGrams")),
                record["date"],
            )
            for col, value in enumerate(values):
                cell = QTableWidgetItem(str(value))
                cell.setData(Qt.UserRole, record["date"])
                cell.setTextAlignment(Qt.AlignCenter)
                self.records_table.setItem(row, col, cell)

    def load_selected_record(self) -> None:
        selected = self.records_table.selectedItems()
        if not selected:
            return
        date_text = selected[0].data(Qt.UserRole)
        record = self.state["recordsByDate"].get(date_text)
        if not record:
            return
        parsed = core.parse_storage_date(date_text)
        today = core.today_local()
        if parsed == today:
            self.date_group.button(0).setChecked(True)
            self.custom_date.clear()
        elif parsed == today - timedelta(days=1):
            self.date_group.button(1).setChecked(True)
            self.custom_date.clear()
        else:
            self.date_group.button(2).setChecked(True)
            self.custom_date.setText(date_text)
        self.update_custom_date_state()
        self.set_food_text(record.get("originalFoodText", ""))
        self.show_record_result(record)

    def period(self) -> str:
        button = self.period_group.checkedButton()
        return button.property("period") if button else "week"

    def period_dates(self) -> list[date]:
        now = core.today_local()
        period = self.period()
        if period == "week":
            start = now - timedelta(days=6)
            return [start + timedelta(days=index) for index in range(7)]
        if period == "month":
            start = date(now.year, now.month, 1)
            next_month = date(now.year + 1, 1, 1) if now.month == 12 else date(now.year, now.month + 1, 1)
            return [start + timedelta(days=index) for index in range((next_month - start).days)]
        return [date(now.year, month, 1) for month in range(1, 13)]

    def graph_values(self) -> list[tuple[str, int]]:
        records_by_date = self.state.get("recordsByDate", {})
        period = self.period()
        values = []
        for day in self.period_dates():
            if period == "year":
                month_total = 0
                for record in records_by_date.values():
                    parsed = core.parse_storage_date(record["date"])
                    if parsed.year == day.year and parsed.month == day.month:
                        month_total += record["caloriesConsumed"]
                values.append((f"{day.month:02d}", month_total))
            else:
                record = records_by_date.get(core.format_date(day))
                values.append((day.strftime("%d/%m"), record["caloriesConsumed"] if record else 0))
        return values


def main() -> None:
    app = QApplication(sys.argv)
    app.setLayoutDirection(Qt.LeftToRight)
    window = CalorieCounterQt()
    window.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
