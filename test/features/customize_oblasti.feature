Feature: Customize time
  I can select time when I want to see events

   январь 2020
   пн	вт	ср	чт	пт	сб	вс
            1	2	3	4	5
   6	7	8	9	10	11	12
   13	14	15	16	17	18	19
   20	21	22	23	24	25	26
   27	28	29	30	31

  Background:
    Given Scene is 'customize_scene'

  Scenario: I can filter only temporary exhibition
    Given there is events:
      | title   | category     | tag_level_1                     | timetable        |
      | A       | exhibitions  | #постояннаяколлекция #доммузей  | вс: 21:59        |
    When I click markup [Области]
    Then Bot responds 'Укажите области' with inline buttons:
      """
      [➕ Кино ]
      [➕ Концерты ]
      [➕ Временные выставки ]
      [➕ Постоянная коллекция ]
      [➕ Театр ]
      [➕ Мероприятия ]
      [➕ Прогулка ]
      """
    When I click inline [Постоянная коллекция]
    Then Bot edits inline buttons:
      """
      [➕ Кино ]
      [➕ Концерты ]
      [➕ Временные выставки ]
      [➖ Постоянная коллекция ]
      [Художественные ]
      [Естественно-научные ]
      [Историко-литературные ]
      [Дом-музей ]
      [➕ Театр ]
      [➕ Мероприятия ]
      [➕ Прогулка ]
      """
    When I click inline [Дом-музей]
    Then Bot edits inline buttons:
      """
      [➕ Кино ]
      [➕ Концерты ]
      [➕ Временные выставки ]
      [➖ Постоянная коллекция ✔]
      [Художественные ]
      [Естественно-научные ]
      [Историко-литературные ]
      [Дом-музей ✔]
      [➕ Театр ]
      [➕ Мероприятия ]
      [➕ Прогулка ]
      """
    When I click markup [◀ Назад]
    Then Bot responds:
    """
    Вы выбрали фильтр:

    #️⃣ <b>Области</b>:  Дом-музей

    <b>1 событие</b> найдено
    """
    When I click markup [Показать события]
    Then Bot responds with event 'A'